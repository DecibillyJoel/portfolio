// Pure helpers for the email router. This file imports nothing, so the unit
// test can read every guard without the Worker runtime.

export const DESTINATION = 'joeofsometrades@outlook.com';
export const OUR_DOMAIN = 'joeofsometrades.com';
export const NOTE_HEADER = 'X-Auto-Reply';
export const SKIP_SUBJECT_PREFIX = '[no auto-reply] ';
export const SUBJECT_LIMIT = 200;

const FALLBACK_SUBJECT = `Your message to ${OUR_DOMAIN}`;
const BOUNDARY = 'joeofsometrades-forwarded-reply';

const AUTOMATED_LOCAL_PARTS = [
  'no-reply',
  'noreply',
  'do-not-reply',
  'mailer-daemon',
  'postmaster',
  'bounce',
];

const AUTOMATED_PRECEDENCE = ['bulk', 'junk', 'list'];

const REPLY_INTRO = 'Thanks for your message.';
const REPLY_FORWARDED = `It has been forwarded to ${DESTINATION}.`;
const REPLY_EXPECT = `Please expect a reply from ${DESTINATION}.`;

function headerValue(value) {
  return String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPrintableAscii(text) {
  return /^[\x20-\x7e]*$/.test(text);
}

function cap(text) {
  return text.length > SUBJECT_LIMIT ? text.slice(0, SUBJECT_LIMIT).trimEnd() : text;
}

function localPart(address) {
  const text = String(address ?? '');
  const at = text.lastIndexOf('@');
  return (at < 0 ? text : text.slice(0, at)).trim().toLowerCase();
}

export function addressDomain(address) {
  const text = String(address ?? '');
  const at = text.lastIndexOf('@');
  if (at < 0) return '';
  return text
    .slice(at + 1)
    .replace(/[>\s]+$/, '')
    .replace(/^\[|\]$/g, '')
    .trim()
    .toLowerCase();
}

// A reply goes out only when the message looks like it came from a person and
// from another domain. Anything else is forwarded without a reply.
export function skipReason(headers, from = '') {
  const read = (name) => headers?.get?.(name) ?? null;

  if (addressDomain(from) === OUR_DOMAIN) return 'own-domain';

  const autoSubmitted = read('Auto-Submitted');
  if (autoSubmitted && autoSubmitted.trim().toLowerCase() !== 'no') return 'automated-sender';
  if (read('X-Auto-Response-Suppress')) return 'automated-sender';
  if (read('List-Unsubscribe') || read('List-Id')) return 'automated-sender';
  if (AUTOMATED_PRECEDENCE.includes(headerValue(read('Precedence')).toLowerCase())) {
    return 'automated-sender';
  }
  if (AUTOMATED_LOCAL_PARTS.includes(localPart(from))) return 'automated-sender';

  return null;
}

export function replyFailureReason(error) {
  const text = String(error?.message ?? error ?? '').toLowerCase();
  if (text.includes('dmarc')) return 'no-dmarc';
  if (text.includes('references')) return 'too-many-references';
  if (text.includes('sender') || text.includes('mismatch')) return 'sender-mismatch';
  return 'platform-refused';
}

export function replySubject(subject) {
  const clean = headerValue(subject);
  if (!clean || !isPrintableAscii(clean)) return FALLBACK_SUBJECT;
  return cap(`Re: ${clean}`);
}

// The forwarded copy keeps the original subject, unless the reply was skipped.
// Then the subject says so, and returns null when no rewrite is needed.
export function forwardedSubject(subject, skipped) {
  if (!skipped) return null;
  const clean = headerValue(subject);
  const body = clean && isPrintableAscii(clean) ? clean : FALLBACK_SUBJECT;
  return cap(`${SKIP_SUBJECT_PREFIX}${body}`);
}

// The reply needs its own Message-ID: the mail runtime refuses to send a
// message without one ("no message-id set"), and every mail client wants it.
export function buildReplyMime({ from, to, subject, messageId, id = crypto.randomUUID(), date = new Date() }) {
  const lines = [
    `From: ${headerValue(from)}`,
    `To: ${headerValue(to)}`,
    `Subject: ${replySubject(subject)}`,
    `Message-ID: <${id}@${OUR_DOMAIN}>`,
    `Date: ${date.toUTCString()}`,
  ];

  const inReplyTo = headerValue(messageId);
  if (inReplyTo) {
    lines.push(`In-Reply-To: ${inReplyTo}`, `References: ${inReplyTo}`);
  }

  lines.push(
    'MIME-Version: 1.0',
    'Auto-Submitted: auto-replied',
    `Content-Type: multipart/alternative; boundary="${BOUNDARY}"`,
    '',
    `--${BOUNDARY}`,
    'Content-Type: text/plain; charset="us-ascii"',
    'Content-Transfer-Encoding: 7bit',
    '',
    REPLY_INTRO,
    REPLY_FORWARDED,
    REPLY_EXPECT,
    '',
    `--${BOUNDARY}`,
    'Content-Type: text/html; charset="us-ascii"',
    'Content-Transfer-Encoding: 7bit',
    '',
    '<!doctype html>',
    '<html lang="en">',
    '<body>',
    `<p>${REPLY_INTRO}</p>`,
    `<p>${REPLY_FORWARDED}</p>`,
    `<p>${REPLY_EXPECT}</p>`,
    '</body>',
    '</html>',
    '',
    `--${BOUNDARY}--`,
    '',
  );

  return lines.join('\r\n');
}
