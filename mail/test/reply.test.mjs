import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DESTINATION,
  HEADER_LIMIT,
  NOTE_HEADER,
  SKIP_SUBJECT_PREFIX,
  SUBJECT_LIMIT,
  addressDomain,
  buildReplyMime,
  dmarcPassed,
  forwardedSubject,
  replyFailureReason,
  replyMessageId,
  replySubject,
  skipReason,
} from '../src/reply.js';

function headers(pairs = {}) {
  const result = new Headers();
  for (const [name, value] of Object.entries(pairs)) result.set(name, value);
  return result;
}

test('addressDomain reads the domain, and nothing else', () => {
  assert.equal(addressDomain('someone@example.com'), 'example.com');
  assert.equal(addressDomain('Someone@Example.COM'), 'example.com');
  assert.equal(addressDomain('someone@[192.0.2.1]'), '192.0.2.1');
  assert.equal(addressDomain('someone@example.com>'), 'example.com');
  assert.equal(addressDomain('no-at-sign'), '');
  assert.equal(addressDomain(''), '');
  assert.equal(addressDomain(undefined), '');
});

test('a message from a person on another domain is answered', () => {
  assert.equal(skipReason(headers({ Subject: 'hello' }), 'friend@example.com'), null);
  assert.equal(skipReason(headers({ 'Auto-Submitted': 'no' }), 'friend@example.com'), null);
});

test('the guard turns away every automated sender', () => {
  const automated = [
    [{ 'Auto-Submitted': 'auto-replied' }, 'friend@example.com'],
    [{ 'Auto-Submitted': 'auto-generated' }, 'friend@example.com'],
    [{ 'X-Auto-Response-Suppress': 'OOF' }, 'friend@example.com'],
    [{ 'X-Auto-Response-Suppress': 'All' }, 'friend@example.com'],
    [{ Precedence: 'bulk' }, 'friend@example.com'],
    [{ Precedence: 'JUNK' }, 'friend@example.com'],
    [{ Precedence: 'list' }, 'friend@example.com'],
    [{ 'List-Unsubscribe': '<mailto:leave@list.example>' }, 'friend@example.com'],
    [{ 'List-Id': '<list.example>' }, 'friend@example.com'],
    [{}, 'no-reply@shop.example'],
    [{}, 'noreply@shop.example'],
    [{}, 'do-not-reply@shop.example'],
    [{}, 'mailer-daemon@example.com'],
    [{}, 'postmaster@example.com'],
    [{}, 'bounce@example.com'],
  ];

  for (const [pairs, from] of automated) {
    assert.equal(skipReason(headers(pairs), from), 'automated-sender', `${from} ${JSON.stringify(pairs)}`);
  }
});

test('the guard turns away our own domain, so a loop cannot start', () => {
  assert.equal(skipReason(headers(), 'joe@joeofsometrades.com'), 'own-domain');
  assert.equal(skipReason(headers(), 'anything@JOEOFSOMETRADES.com'), 'own-domain');
});

test('a missing header set is treated as a message from a person', () => {
  assert.equal(skipReason(undefined, 'friend@example.com'), null);
});

test('replyFailureReason names the four ways a reply can be refused', () => {
  assert.equal(replyFailureReason(new Error('DMARC check failed for the message')), 'no-dmarc');
  assert.equal(replyFailureReason(new Error('too many References headers')), 'too-many-references');
  assert.equal(replyFailureReason(new Error('sender does not match the original')), 'sender-mismatch');
  assert.equal(replyFailureReason(new Error('service unavailable')), 'platform-refused');
  assert.equal(replyFailureReason('plain string error'), 'platform-refused');
  assert.equal(replyFailureReason(undefined), 'platform-refused');
});

test('replySubject puts Re: in front of a plain subject', () => {
  assert.equal(replySubject('A question'), 'Re: A question');
  assert.equal(replySubject('  spaced  out  '), 'Re: spaced out');
  assert.equal(replySubject('line\r\nbreak\there'), 'Re: line break here');
});

test('replySubject falls back when there is nothing to reply to', () => {
  const fallback = 'Your message to joeofsometrades.com';
  assert.equal(replySubject(''), fallback);
  assert.equal(replySubject('   '), fallback);
  assert.equal(replySubject(undefined), fallback);
  assert.equal(replySubject('héllo'), fallback);
});

test('replySubject holds the subject inside the limit', () => {
  const long = 'x'.repeat(400);
  const subject = replySubject(long);
  assert.equal(subject.length, SUBJECT_LIMIT);
  assert.ok(subject.startsWith('Re: xxx'));
});

test('the forwarded copy is rewritten only when the reply was skipped', () => {
  assert.equal(forwardedSubject('A question', null), null);
  assert.equal(forwardedSubject('A question', 'no-dmarc'), `${SKIP_SUBJECT_PREFIX}A question`);
  assert.equal(
    forwardedSubject('', 'automated-sender'),
    `${SKIP_SUBJECT_PREFIX}Your message to joeofsometrades.com`,
  );
  const long = forwardedSubject('y'.repeat(400), 'platform-refused');
  assert.equal(long.length, SUBJECT_LIMIT);
  assert.ok(long.startsWith(SKIP_SUBJECT_PREFIX));
});

test('the reply is a CRLF, printable ASCII multipart message', () => {
  const mime = buildReplyMime({
    from: 'joe@joeofsometrades.com',
    to: 'friend@example.com',
    subject: 'A question',
    messageId: '<abc@mail.example.com>',
    date: new Date('2026-11-01T12:00:00Z'),
  });

  assert.equal(/[^\r]\n/.test(mime), false, 'every newline is a CRLF pair');
  assert.equal(/^[\x20-\x7e\r\n]*$/.test(mime), true, 'the whole message is printable ASCII');
  assert.match(mime, /^From: joe@joeofsometrades\.com\r\nTo: friend@example\.com\r\nSubject: Re: A question\r\n/);
  assert.match(mime, /\r\nDate: Sun, 01 Nov 2026 12:00:00 GMT\r\n/);
  assert.match(mime, /\r\nIn-Reply-To: <abc@mail\.example\.com>\r\n/);
  assert.match(mime, /\r\nReferences: <abc@mail\.example\.com>\r\n/);
  assert.match(mime, /\r\nAuto-Submitted: auto-replied\r\n/);
  assert.match(mime, /\r\nContent-Type: multipart\/alternative; boundary="joeofsometrades-forwarded-reply"\r\n/);
  assert.match(mime, /Content-Type: text\/plain; charset="us-ascii"/);
  assert.match(mime, /Content-Type: text\/html; charset="us-ascii"/);

  const boundary = 'joeofsometrades-forwarded-reply';
  assert.equal(mime.split(`--${boundary}`).length - 1, 3, 'opening, separator and closing boundary');
  assert.ok(mime.endsWith(`--${boundary}--\r\n`), 'the message ends on the closing boundary');

  assert.equal(mime.split(DESTINATION).length - 1, 4, 'each body names the destination twice');
  const text = mime.split(`--${boundary}`)[1];
  const html = mime.split(`--${boundary}`)[2];
  assert.ok(text.includes(`It has been forwarded to ${DESTINATION}.`));
  assert.ok(text.includes(`Please expect a reply from ${DESTINATION}.`));
  assert.ok(html.includes(`<p>It has been forwarded to ${DESTINATION}.</p>`));
  assert.ok(html.includes(`<p>Please expect a reply from ${DESTINATION}.</p>`));
  assert.match(mime, /Thanks for your message\./);
});

test('the reply carries no threading headers without a message id', () => {
  const mime = buildReplyMime({
    from: 'joe@joeofsometrades.com',
    to: 'friend@example.com',
    subject: 'A question',
    messageId: null,
    date: new Date('2026-11-01T12:00:00Z'),
  });

  assert.equal(mime.includes('In-Reply-To'), false);
  assert.equal(mime.includes('References'), false);
});

test('the note header name is stable', () => {
  assert.equal(NOTE_HEADER, 'X-Auto-Reply');
});

test('the reply carries a Message-ID on our domain', () => {
  const mime = buildReplyMime({
    from: 'joe@joeofsometrades.com',
    to: 'friend@example.com',
    subject: 'A question',
    id: 'fixed-id',
    date: new Date('2026-11-01T12:00:00Z'),
  });

  assert.match(mime, /\r\nMessage-ID: <fixed-id@joeofsometrades\.com>\r\n/);
});

test('every reply gets its own Message-ID', () => {
  const build = () =>
    buildReplyMime({
      from: 'joe@joeofsometrades.com',
      to: 'friend@example.com',
      subject: 'A question',
      date: new Date('2026-11-01T12:00:00Z'),
    });

  const first = build();
  const second = build();
  assert.match(first, /\r\nMessage-ID: <[0-9a-f-]{36}@joeofsometrades\.com>\r\n/);
  assert.notEqual(first.match(/Message-ID: <([^>]+)>/)[1], second.match(/Message-ID: <([^>]+)>/)[1]);
});

test('a header value loses every control character', () => {
  const mime = buildReplyMime({
    from: 'sender@example.com',
    to: 'joe@joeofsometrades.com',
    subject: 'line one\u0000\u0007 line two',
    messageId: '<id@example.com>',
    id: 'fixed',
    date: new Date(0),
  });
  assert.doesNotMatch(mime, /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/);
  assert.match(mime, /Subject: Re: line one line two\r\n/);
});

test('an over long header value is cut at the cap', () => {
  const long = 'a'.repeat(500);
  const mime = buildReplyMime({
    from: `${long}@example.com`,
    to: 'joe@joeofsometrades.com',
    subject: 'hello',
    messageId: null,
    id: 'fixed',
    date: new Date(0),
  });
  const from = mime.split('\r\n').find((line) => line.startsWith('From: '));
  assert.equal(from.length, 'From: '.length + HEADER_LIMIT);
});

test('a malformed message id never reaches the threading headers', () => {
  for (const value of ['', null, 'not-an-id', '<unclosed', 'no-brackets@example.com', `<${
    'a'.repeat(300)
  }@example.com>`]) {
    assert.equal(replyMessageId(value), '', `${value} must be dropped`);
  }
  assert.equal(replyMessageId('<abc@example.com>'), '<abc@example.com>');

  const mime = buildReplyMime({
    from: 'sender@example.com',
    to: 'joe@joeofsometrades.com',
    subject: 'hello',
    messageId: 'not-an-id',
    id: 'fixed',
    date: new Date(0),
  });
  assert.doesNotMatch(mime, /In-Reply-To|References/);
});

test('only the authentication result Cloudflare prepends counts', () => {
  const pass = 'mx.cloudflare.net; spf=pass; dkim=pass; dmarc=pass';
  assert.equal(dmarcPassed(headers({ 'Authentication-Results': pass })), true);

  for (const value of [
    'mx.cloudflare.net; spf=fail; dkim=none; dmarc=fail',
    'mx.cloudflare.net; spf=pass; dkim=pass; dmarc=none',
    'mx.google.com; dmarc=pass',
    'dmarc=pass',
    '',
  ]) {
    assert.equal(dmarcPassed(headers({ 'Authentication-Results': value })), false, value);
  }

  assert.equal(dmarcPassed(headers({})), false);
  assert.equal(dmarcPassed(undefined), false);

  // The sender can send their own copy, and the runtime keeps both, joined by
  // ", ". The first value is Cloudflare's, and only that one decides.
  const forged = `${pass}, mx.forged.test; dmarc=fail`;
  assert.equal(dmarcPassed(headers({ 'Authentication-Results': forged })), true);
  const forgedOnly = 'mx.forged.test; dmarc=pass, mx.cloudflare.net; dmarc=fail';
  assert.equal(dmarcPassed(headers({ 'Authentication-Results': forgedOnly })), false);
});
