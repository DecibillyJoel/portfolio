import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DESTINATION,
  NOTE_HEADER,
  SKIP_SUBJECT_PREFIX,
  SUBJECT_LIMIT,
  addressDomain,
  buildReplyMime,
  forwardedSubject,
  replyFailureReason,
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
  assert.equal(skipReason(headers({ Subject: 'hello' }), 'friend@gmail.com'), null);
  assert.equal(skipReason(headers({ 'Auto-Submitted': 'no' }), 'friend@gmail.com'), null);
});

test('the guard turns away every automated sender', () => {
  const automated = [
    [{ 'Auto-Submitted': 'auto-replied' }, 'friend@gmail.com'],
    [{ 'Auto-Submitted': 'auto-generated' }, 'friend@gmail.com'],
    [{ 'X-Auto-Response-Suppress': 'OOF' }, 'friend@gmail.com'],
    [{ 'X-Auto-Response-Suppress': 'All' }, 'friend@gmail.com'],
    [{ Precedence: 'bulk' }, 'friend@gmail.com'],
    [{ Precedence: 'JUNK' }, 'friend@gmail.com'],
    [{ Precedence: 'list' }, 'friend@gmail.com'],
    [{ 'List-Unsubscribe': '<mailto:leave@list.example>' }, 'friend@gmail.com'],
    [{ 'List-Id': '<list.example>' }, 'friend@gmail.com'],
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
  assert.equal(skipReason(undefined, 'friend@gmail.com'), null);
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
    to: 'friend@gmail.com',
    subject: 'A question',
    messageId: '<abc@mail.gmail.com>',
    date: new Date('2026-11-01T12:00:00Z'),
  });

  assert.equal(/[^\r]\n/.test(mime), false, 'every newline is a CRLF pair');
  assert.equal(/^[\x20-\x7e\r\n]*$/.test(mime), true, 'the whole message is printable ASCII');
  assert.match(mime, /^From: joe@joeofsometrades\.com\r\nTo: friend@gmail\.com\r\nSubject: Re: A question\r\n/);
  assert.match(mime, /\r\nDate: Sun, 01 Nov 2026 12:00:00 GMT\r\n/);
  assert.match(mime, /\r\nIn-Reply-To: <abc@mail\.gmail\.com>\r\n/);
  assert.match(mime, /\r\nReferences: <abc@mail\.gmail\.com>\r\n/);
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
    to: 'friend@gmail.com',
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
    to: 'friend@gmail.com',
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
      to: 'friend@gmail.com',
      subject: 'A question',
      date: new Date('2026-11-01T12:00:00Z'),
    });

  const first = build();
  const second = build();
  assert.match(first, /\r\nMessage-ID: <[0-9a-f-]{36}@joeofsometrades\.com>\r\n/);
  assert.notEqual(first.match(/Message-ID: <([^>]+)>/)[1], second.match(/Message-ID: <([^>]+)>/)[1]);
});
