# Tested live-shop behavior

Use these decisions to guide implementation, not as a template to paste into every project. Inspect the target repository for the current version. OneStyle's live source is the owner's `abdulelah217-dev/onestyle-site`; `yallarideapp/onestyle` is a separate public preview and is not automatically synchronized. Do not use these repo names for another shop.

## Adapters and published content

OneStyle keeps shared storefront files and guarded hooks (`window.OneStyleLive`) plus a live-only `live.js`/`live.css` layer added at build time. Browser-only preview accounts live in a separate adapter excluded from the live build. A framework project can use an equivalent separation rather than copying this file layout.

- Store published catalog/settings together with a version; require compare-and-swap updates and return conflict on stale writes. Clean content on the server using the same approved functions as the frontend.
- Keep private integration settings outside public content. Exclude admin-only stock quantities, hidden products, internal notes, credentials and customer data from shopper responses and page HTML.
- All category names and IDs come from shared configuration. Added categories flow through Explore, collection filters and admin product/specification choices. Keep product conditions separate from hardware categories. Preserve used-device battery health/cycles and new-device badges if the shop has them.
- Hero images and category images are separate controls even if they share defaults. Preserve all existing device slots and animations when changing the live adapter. Describe which image each admin setting controls.
- Seed the server's initial content intentionally. Do not fall back to bundled demo products after a network or content API error. Retain usable real server-rendered content with bounded loading, retry and missing-script recovery.
- Crawlable addresses include English and Arabic paths. Hidden devices return 404/noindex; renamed public devices retain safe old-slug redirects. Keep reset tokens after `#`, and private pages out of indexing.

## Orders and prices

OneStyle's approved formula (not a universal shop formula):

```text
unitPrice = startPrice + (ram - ramOptions[0]) * 9 + storageIndex * 75
```

Use an offer only below the base price. Delivery fees come from current settings, pickup is free. Recompute in integer fils and require the submitted total to match exactly. Reject hidden/sold-out products and invalid variants before saving.

- Commit the order, lines and unique sequential order number atomically. An idempotency key returns the original order on duplicate/concurrent submissions and must not generate duplicate alerts.
- OneStyle allows at most **20 units per line and 20 lines**. Other projects retain their approved limits.
- Its order limits are 5/hour and 20/day per IP, and 100/hour and 1,000/day shop-wide; sign-up is 5/hour and 20/day per IP. Group IPv6 by /56. Attempts live in D1, not process memory.
- Ordering remains off until the owner enables `settings.checkout.ordersOn`; the same policy controls indexing. Preserve WhatsApp fallback while off.
- Rate limits, type/size validation, same-origin checks, cleaned single-line fields and guarded admin operations apply before mutations. Expose useful translated errors without exposing SQL, secrets or raw provider responses.
- Repairs/tracking belong only in sites that offer them. If present, require the agreed pair of identifiers and return limited status information, not a publicly enumerable customer record.

## Accounts and email resets

Preserve the target site's approved security parameters and old hash verification. OneStyle uses:

- PBKDF2-SHA-256, **20,000 rounds** to fit its free-plan CPU budget; do not change this without Jafar and real CPU measurements. Shoppers: 8–200 characters, at least one letter, not a common password; admin: 10–200. Shared policy file is built into the Worker and used by the live/preview forms.
- Random session tokens stored hashed; `HttpOnly; Secure; SameSite=Strict`. Admin cookie `Path=/api/admin`, 12 hours; shopper `Path=/api`, 7 days. A generation counter invalidates older sessions after password change/reset.
- Reset links are one-time, expire after 30 minutes and carry the secret token only after `#`. Forgot-password responses do not distinguish known/unknown addresses. Admin resets go only to configured `ADMIN_EMAIL`.
- Reset UI is hidden until `RESEND_API_KEY`, `MAIL_FROM` and `SITE_URL` are set. Daily budgets: order mail 50, shopper resets 30, admin resets 6, leaving headroom under the configured provider plan. Keep the two newest earlier reset links when issuing a new one.

For another project choose or preserve an appropriate policy; do not copy old performance constraints as general cryptography recommendations. Never weaken an established password policy silently.

## Image upload behavior

OneStyle's built-in device photography is WebP; its favicon is SVG. The admin currently accepts **PNG/JPEG/WebP up to 1.5 MB** and reads the uploaded bytes unchanged. The live adapter uploads them to `/api/admin/photo`, and the Worker checks magic bytes match the declared MIME. It stores bytes/type in KV and serves `/api/photo/<id>`. This pipeline does **not** automatically convert a new JPG/PNG to WebP.

If adding conversion for a site, implement a real client/build pipeline, preserve orientation/aspect ratio/transparency, enforce server limits on the resulting bytes and verify quality. Never replace server validation with client conversion. Cache immutable photo IDs appropriately; verify actual custom-domain versus `workers.dev` cache behavior before estimating KV usage.

## Local tests and regressions

OneStyle's commands: `npm test`, `npm run test:api`, `npm run test:accounts`, `npm run test:telegram`, `npm run test:browser`, `npm run test:widths`, `npm run test:preview`. The local runner starts fresh D1/KV, a Worker on port 8788 and fake external services on port 8799, and refuses `.env`/`.dev.vars`. Preserve separation from real secrets and production data.

Meaningful cases include server/client price parity, hidden stock, image magic bytes, concurrent orders, retry idempotency, authorization, password compatibility, reset token reuse/expiry, email budgets, stale writes and actual admin-to-storefront propagation. Use approved browser tooling for full flows and Arabic/English widths 320–1440; record replacements and blocked tests accurately.

Observed local pitfall: a development watcher on a newly copied `dist/` under a synced Documents directory restarted the Worker during slow provider tests and returned raw HTTP 503. Serving an identical, immutable temporary asset snapshot stabilized those tests. Diagnose reload logs before treating such a transport failure as an application bug. Clean up the snapshot and process tree on exit; never broadly retry application errors to make tests green.

## Handover and remaining verification

Record what is actually observed. For example, local fake-provider tests confirm request construction and failure behavior, not inbox delivery; a Telegram API acceptance confirms acceptance, not that the owner's phone notification appeared. Production CPU and real device behavior need their own checks.

Keep Arabic owner steps concrete: account/repo ownership, Cloudflare bindings/secrets, migration-before-deploy, order switch, domain/mail sender, Telegram setup and rollback. A code rollback leaves schema/data in place, so ensure compatibility. A source ZIP is not a deployment and should not contain local credentials, dependencies or generated files.
