# mail

The Email Router Worker for joeofsometrades.com.

Cloudflare Email Routing calls this Worker for every message that reaches the
domain. The Worker does two things.

1. It forwards the message to `joeofsometrades@outlook.com`.
2. It answers the sender with a short note that names that address.

A failure to answer never stops the forward.

## Files

- `wrangler.jsonc` — the Worker configuration. It serves no HTTP traffic, so the
  workers.dev address and the preview URLs stay off.
- `src/index.js` — the `email` handler.
- `src/reply.js` — the pure helpers: the spam guards, the subject rules and the
  MIME builder. The file imports nothing, so the test can read it on its own.
- `test/reply.test.mjs` — the unit test.

## Commands

```sh
npm run test:mail                          # unit test, no network
npx wrangler deploy -c mail/wrangler.jsonc # deploy
npx wrangler tail email-router             # live log
```

## Rollback

Repoint the catch-all rule at the destination address, or delete the catch-all
rule and add a literal rule for the address. Both happen in the Cloudflare
dashboard under Email > Email Routing, or through the API.

## Notes

- The Worker holds no dependency, so it needs no compatibility flag.
- The reply goes out only when the message looks like it came from a person on
  another domain. Automated senders are forwarded without an answer.
- The reply carries its own `Message-ID` on our domain. The mail runtime refuses
  to send a message without one, and it says so as `no message-id set`.
- The forwarded copy carries an `X-Auto-Reply` header. When the reply was
  skipped, the subject is prefixed with `[no auto-reply] `.
