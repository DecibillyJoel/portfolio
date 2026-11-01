// Email Routing calls this Worker for every message that reaches the domain.
// It forwards the message to the destination address, and answers the sender
// with a short note. A failure to answer never stops the forward.

import { EmailMessage } from 'cloudflare:email';
import {
  DESTINATION,
  NOTE_HEADER,
  buildReplyMime,
  forwardedSubject,
  replyFailureReason,
  skipReason,
} from './reply.js';

function log(event, message, reason, detail) {
  const line = { event, sender: message.from, reason };
  if (detail) line.detail = detail;
  console.log(JSON.stringify(line));
}

export default {
  async email(message) {
    const subject = message.headers.get('Subject') ?? '';
    let skipped = skipReason(message.headers, message.from);

    if (skipped) {
      log('reply-skipped', message, skipped);
    } else {
      try {
        const reply = buildReplyMime({
          from: message.to,
          to: message.from,
          subject,
          messageId: message.headers.get('Message-ID'),
          date: new Date(),
        });
        await message.reply(new EmailMessage(message.to, message.from, reply));
      } catch (error) {
        skipped = replyFailureReason(error);
        // The mapped reason is not enough to act on: keep the runtime's own
        // words in the log too.
        log('reply-failed', message, skipped, String(error?.message ?? error));
      }
    }

    const note = skipped ? `skipped: ${skipped}` : 'sent';
    const headers = new Headers();
    headers.set(NOTE_HEADER, note);
    const rewrite = forwardedSubject(subject, skipped);
    if (rewrite) headers.set('Subject', rewrite);

    try {
      await message.forward(DESTINATION, headers);
    } catch (error) {
      // The runtime may refuse a custom Subject header. Mail must never be lost
      // over a note, so try once more with only the always safe header.
      log('forward-retry', message, String(error?.message ?? error));
      const retry = new Headers();
      retry.set(NOTE_HEADER, note);
      await message.forward(DESTINATION, retry);
    }

    log('forwarded', message, note);
  },
};
