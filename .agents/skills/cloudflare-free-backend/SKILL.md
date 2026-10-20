---
name: cloudflare-free-backend
description: "Use when Jafar asks to take one of his sites live on Cloudflare's free plan (Workers + D1 + KV) instead of Hostinger: real orders, admin edits shared by everyone, uploaded photos, no card, deployed from GitHub on every push."
---

# Free live backend on Cloudflare (Workers + D1 + KV)

Decided with Jafar on 17 Oct 2026: a shop that won't pay for hosting gets a free live site on Cloudflare instead of Hostinger PHP. Build it **only when he asks** ("اعمل الربط", "نزّله على Cloudflare"), for any project. Until then the browser-local demo stays as it is.

`shop-website-playbook` still decides what a shop site needs, and `website-delivery-layout` decides the folders and the handover. This skill replaces only the PHP/Hostinger parts: the API, storage, upload ZIP and Hostinger guide.

## Why Cloudflare and not the others (tell him in one line if he asks again)

- **Firebase Spark (free):** hosting is capped at 360 MB/day, which is about 170 first visits a day with WebP pictures. Cloud Storage and Cloud Functions need Blaze, which means a card, and budget alerts don't stop spending. Fine on Blaze if the shop pays with its own card.
- **GitHub Pages:** its terms forbid running a shop on it. Keep it for client previews only.
- **Supabase free:** projects can pause after a week of low activity.
- **Cloudflare + Firebase together:** works, but it means two accounts, and the Admin SDK doesn't run in Workers. Not worth it for a small shop.

## Free limits (re-check the official pages before quoting them; they change)

| Service | Free plan |
|---|---|
| Static assets (site, pictures) | Requests free and unlimited |
| Worker (API) | 100,000 requests/day, 10 ms CPU per request |
| D1 (SQL, SQLite) | 10 databases, 500 MB each, 5 GB per account, 5M rows read and 100k rows written per day |
| KV | 1 GB, 100k reads/day, 1,000 writes/deletes/lists per day |

Sources: developers.cloudflare.com/workers/platform/limits, /workers/static-assets/billing-and-limitations, /d1/platform/limits, /workers/ci-cd/builds/limits-and-pricing, and cloudflare.com/pricing.

The only cost is the domain, which the shop pays for yearly. Its DNS must be on Cloudflare (change the nameservers) to attach it to the Worker. Before that, the site runs on `<name>.<account>.workers.dev`.

## Accounts (his rules apply)

- The Cloudflare account is created **in the shop's name** with a new email. **Jafar signs up himself.** Never log in for him, never type his passwords, never handle a card.
- Deploys come from GitHub (next section). The first-time setup (creating D1 and KV, the first migration, the secrets) is done by him, either in the dashboard or with `npx wrangler login` on his computer. He types the secrets himself, under **Settings > Variables & Secrets** or with `npx wrangler secret put NAME`.
- Nothing is published, bought or sent to the client without his explicit yes.

## GitHub: push to deploy (decided 17 Oct 2026)

He keeps the code on GitHub, and Cloudflare deploys it on every push (Workers Builds).

- **The source repo is private** and separate from any public preview repo (the runtime-only GitHub Pages preview stays as it is, or is deleted after going live). It holds the source: the site, `worker/`, `migrations/`, `wrangler.jsonc`, tests, `AGENTS.md` and the context file, so every edit goes to the source, never to the built files.
- **Never in the repo:** secrets (Resend key, setup code), `.dev.vars`, `node_modules/`, `dist/`, `.wrangler/`. Put them in `.gitignore` and scan before every push.
- **Connecting:**
  - In the shop's Cloudflare account: Workers & Pages > Create application > GitHub, then pick the repo. For an existing Worker: Settings > Builds > Connect.
  - He authorizes the Cloudflare GitHub app for that one repo only.
  - The Worker's name in the dashboard must match `name` in `wrangler.jsonc`, or the build fails.
- **Build settings:**
  - Root directory: the folder that holds `package.json` and `wrangler.jsonc`.
  - Build command: `npm ci && npm run build`.
  - Deploy command: `npm run deploy`, where the `deploy` script runs `wrangler d1 migrations apply DB --remote && wrangler deploy`, so migrations run before the new code goes live.
  - Build variables are build-only. Runtime secrets live under Settings > Variables & Secrets.
- **Branches:** production branch `main`. Other branches get preview builds with their own URL, for trying a change before it goes live. A preview shares the production D1 unless a separate preview database is bound, so say so before testing orders on a preview.
- **Free Workers Builds:** 3,000 build minutes a month, 1 build at a time, 20-minute timeout.
- **Commits:** as `yallarideapp <227899290+yallarideapp@users.noreply.github.com>`, with no tool names in messages, code or files. Push only what he asked for, and only to the repo he named.

## Architecture

```
site/            the existing front end (React/TS or vanilla), built to dist/
worker/src/      index.ts (router), orders.ts, content.ts, admin.ts, repairs.ts, photos.ts, pricing.ts (shared with the front end)
migrations/      0001_init.sql …
wrangler.jsonc   assets.directory = dist, not_found_handling = single-page-application, D1 + KV bindings
```

- **One Worker** serves `dist/` as static assets and answers `/api/*`. Hash routes need nothing on the server.
- **D1 tables:**
  - `content` (one row: the published JSON + version), `orders`, `order_lines`, `repairs`, `counters`.
  - `sessions` (hashed token, expiry), `login_attempts`.
  - Money in fils (integers).
- **KV:** the shop's uploaded photos, as `photo:<id>` → WebP bytes, served by `/api/photo/<id>` with long cache headers. The browser resizes before upload (≤1000 px, WebP), as in the demo. Max 25 MiB per value, but keep it under 1 MB. Mind the 1,000 writes/day.
- **Never put orders in KV:** two writes at the same moment can lose one, and the write limit is low. Orders go in D1.
- **Built-in pictures:** WebP at the same resolution in `dist/assets/` (PNG → WebP took one shop's picture sheets from 14 MB to 1.6 MB; masks lossless).

## Server rules (same as the PHP API in shop-website-playbook)

- **`POST /api/order`:**
  - Requirements: HTTPS, same origin (`Origin`, or `Sec-Fetch-Site`), exact `application/json`, body cap (e.g. 16 KB), and orders turned on in the settings.
  - Prices come from the published content, never from the request. The shopper's total must match (fils). At most 5 per line and 30 lines. Unknown or sold-out product or variant: refuse with a translated message.
  - Order number from `counters` in the same `db.batch()` as the insert (`UPDATE … RETURNING`), so two orders never share a number.
  - Rate limit per IP (`CF-Connecting-IP`), stored in D1.
- **Repairs:** same checks. Tracking needs number **and** mobile and returns only status and dates.
- **Admin:**
  - A setup code creates the password. Store a hash using PBKDF2-SHA-256 (WebCrypto).
  - Session cookie: `HttpOnly; Secure; SameSite=Strict`, random 32-byte token stored hashed. Lock out after repeated failures.
  - Publish uses a version check (409 on conflict), as in the playbook.
- **CPU 10 ms:**
  - PBKDF2 is CPU work; Workers allow at most 100,000 iterations.
  - After the first deploy, check the login's CPU time in the dashboard. If it goes over, say so and agree with him (fewer iterations with a long random password, or another approach). Don't quietly weaken it.
- **Order email:** send via the Resend API with `fetch` (`RESEND_API_KEY` secret, `Idempotency-Key` per order, short timeout), and save the order before trying the email. The WhatsApp message stays as it is in the demo.
- **Headers:** CSP, `X-Content-Type-Options`, `Referrer-Policy`. JSON escaped. No secret ever reaches `dist/`.

## Front end changes

- Keep **two builds**: the portable demo (localStorage, works from disk) and the live build (API). Choose with a build flag; the store's functions stay the same and switch adapter.
- Live: content loads from `/api/content` and falls back to the built-in seed only before the first publish. Orders, repairs and the admin call the API. The bag stays in localStorage.
- Keep every demo behaviour: offer-price rules, option keys, Arabic digits, toasts, campaign dates, etc.

## Testing (all in the cloud workspace; nothing runs on his account)

1. `npm i -D wrangler`. Run `npx wrangler d1 migrations apply DB --local`, then `npx wrangler dev` (local D1 and KV).
2. Run the site's browser tests against `wrangler dev`: order, repair and tracking, admin login, publish, photo upload, two browsers seeing the same change.
3. Abuse tests with Python `http.client`: foreign Origin, wrong content type, oversized body, price tampering, quantity above 5, unknown ids, two orders at once (distinct numbers), admin calls without a session, a tampered cookie, the lockout, and tracking with a wrong mobile.
4. Have an independent subagent review the Worker code; fix its findings and retest.
5. Say plainly what did not run: his real Cloudflare account, production CPU times, real email delivery, a real iPhone.

## Delivery

- Replace the Hostinger upload ZIP and guide with **`Cloudflare-guide.md`** (Arabic), covering:
  - creating the account in the shop's name
  - creating the private GitHub repo and connecting it (Workers Builds, settings above)
  - `npm install`, `wrangler login`
  - creating D1 and KV (`wrangler d1 create`, `wrangler kv namespace create`) and pasting the ids into `wrangler.jsonc`
  - `wrangler d1 migrations apply DB --remote`
  - `wrangler secret put` for each secret
  - the first deploy (a push to `main`, or `wrangler deploy`)
  - first admin password with the setup code
  - attaching the domain
  - where to see usage and the free limits
- The source ZIP includes `worker/`, `migrations/` and `wrangler.jsonc` with placeholder ids, never real secrets.
- After that, an update is a push to `main`. Say how to roll back: Deployments > pick the previous version, or revert the commit.
- Update `AGENTS.md`, the context file's log, `Source/README-AR.md`, and the `shop-website-playbook`-style reply (short, Arabic, what changed, what was tested, what wasn't).
- No tool traces anywhere (code, build, guides, commits).

## First build

The first project to use this has not been built yet (17 Oct 2026). After the first build, update this skill with whatever was learned (real CPU times, wrangler versions, pitfalls), proposing the full updated skill.