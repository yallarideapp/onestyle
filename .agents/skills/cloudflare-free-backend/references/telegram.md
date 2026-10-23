# Telegram order alerts through BotFather

Use this for owner-configured server alerts. BotFather creates the bot identity/token; the website's server sends saved orders through the Bot API. The owner's phone does not host the backend, and the admin page need not stay open.

## Owner's setup, including on a phone

1. Open the official [@BotFather](https://t.me/BotFather) in Telegram, run `/newbot`, choose the requested name/username and copy the generated bot token privately.
2. Open the new bot, press **Start**, and send it a message. For a shop group, add the bot and send a command addressed to it so the message is visible to the bot.
3. Sign into the site's admin → Telegram connection (OneStyle: **Contact & delivery**). Paste the token into its password field. Do not ask the owner to send it in a conversation or put it in a URL.
4. Use **Find chat**, explicitly select the desired private/group chat, or enter its numeric Chat ID manually. Include negative group IDs.
5. Save/validate the connection, send one test when authorized, confirm receipt on the phone and enable order alerts. Explain disable versus remove, and how to reconnect after revoking a token in BotFather.

Provide those controls in the admin, with Arabic and English help, mobile layout and safe status messages. Save validates without sending a message; Test is a separate, explicit action. An already-authorized request to test a configured connection does not require repetitive confirmation.

See [Telegram's setup tutorial](https://core.telegram.org/bots/tutorial#obtain-your-bot-token) and [Bot API](https://core.telegram.org/bots/api) for current contracts.

## Private configuration and concurrency

- Store token, target Chat ID, enabled flag, bot username, opaque revision and last-attempt status in a private backend table. Deployment-owned alternatives can use runtime secrets, but do not fake an editable admin control for a read-only secret.
- Require a valid admin session for every operation and same-origin/CSRF checks for mutations. Cap body size, validate token/ID types and rate-limit provider calls. A shopper session is not an admin session.
- Return only metadata and `configured: true/false`; never return the saved token or a reversible mask. Blank token on edit retains it, including a supported offline disable. Removing deletes the credential row.
- Require an opaque fresh version on save/remove. A random revision prevents stale writes and remove/recreate ABA collisions. Do not use only a timestamp/counter that resets on deletion.
- UI callbacks must survive language changes, route changes and sign-out: keep the complete busy form disabled across re-renders, ignore stale epochs/detached lookup results, clear private state on logout and release loading flags after session expiry.

## Provider requests and chat discovery

- Fixed HTTPS origin `https://api.telegram.org`; never accept a provider URL from a form/request. Allow a local fake service only through trusted test environment configuration restricted to HTTP loopback.
- Use a tested bounded timeout covering both fetch and body parsing, e.g. an abort signal plus an overall deadline. Reject redirects explicitly, using `redirect: 'manual'` and no redirect-follow path if that is the supported runtime behavior. OneStyle's installed workerd rejected `redirect: 'error'` despite documentation listing it, so test the installed runtime.
- Validate the bot with `getMe` (`is_bot`/username), validate the target with `getChat` and send with `sendMessage`. Translate fixed error codes; never reflect upstream descriptions, request URLs, headers or tokens into responses/logs.
- `getUpdates` discovery uses a bounded response/timeout, no `offset`, no `allowed_updates`, no webhook deletion. Deduplicate IDs, limit displayed candidates and escape labels. Let the admin choose; never silently pick the first chat.
- An existing webhook or concurrent poller may prevent discovery. Offer manual Chat ID entry and recommend a dedicated alert bot; never disrupt another integration to make Find chat work. Updates can expire, so an empty list is not proof of an invalid token: send another message and retry.

## Order delivery semantics

- Send only after a successful order commit, from the server (`ctx.waitUntil` or an equivalent background mechanism). An alert failure/timeout must not reject or erase the saved order, alter its number or encourage a duplicate checkout.
- Keep alert scheduling behind the new-order/idempotency branch. Duplicate and concurrent retries must not send again for the same saved order.
- Include order number, concise item/variant summary, total, fulfilment method and an authenticated admin link. Keep customer phone/address/notes inside admin unless the user explicitly needs them in Telegram. Use plain text/no parse mode and disable link previews where appropriate.
- Reserve space for total and admin link **before** truncating item names. Keep a safe margin under the provider message limit (OneStyle uses 3900 characters). Test maximum line counts and unusually long names.
- Show last success/failure with a time. Describe the guarantee honestly: OneStyle uses best-effort background delivery, **without automatic resend/outbox**. If durable retries are required, build a bounded queue/outbox with appropriate deduplication rather than promising delivery from `waitUntil` alone.

## Tests before real connection

Use a local fake Telegram API and dummy tokens. Verify metadata/public HTML/exports never contain a token; unauthenticated/shopper/foreign-origin requests fail; invalid IDs/tokens are rejected; stale writes, disconnect/reconnect and blank-token updates behave correctly; offline disable works; chat lookup does not modify webhook/subscription state.

Exercise a successful saved order, duplicate/concurrent retry, maximum-length message, unavailable provider, never-ending fetch/body and rate limiting. Orders must complete while alerts are slow or fail. Confirm the timeout in the real local Worker runtime, not just a mock JavaScript environment. Check mobile/RTL form layout, busy states across language changes and logout while a request is pending.

Before deployment, state that only fake-provider delivery has been tested. After an authorized deployment the owner enters his real token and target in admin and confirms a test arrives. Never claim production alerts are connected merely because the panel exists.
