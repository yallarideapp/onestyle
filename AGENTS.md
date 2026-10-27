# One Style — rules for coding agents

Read `ONESTYLE-CONTEXT.md` first (Arabic): what the site is, its status and the change log.

## What this repo is

- The **source** of the live One Style site on Cloudflare (Workers + Static Assets + D1 + KV).
- The live source lives in the owner's private repo `abdulelah217-dev/onestyle-site`. This public repo, `yallarideapp/onestyle`, keeps the GitHub Pages preview and explicitly requested source synchronizations. They do not sync automatically; Cloudflare deploys from the owner repo.
- The Pages workflow (`.github/workflows/deploy.yml`) publishes only the storefront files (`index.html`, `app.js`, `admin.js`, `legal.js`, `data.js`, `settings.js`, the CSS files, `assets/`). Keep that list explicit: never publish `worker/`, `tests/`, the guides or this file on Pages.
- Pull and rebase before any change: Jafar, ChatGPT and Claude all push here.

## Layout

- Storefront (shared with the preview): `index.html`, `app.js`, `admin.js`, `legal.js`, `data.js`, `settings.js`, `styles.css`, `admin.css`, `customization.css`, `assets/`.
  - Opened from disk, these still run as the browser-only preview. Keep that working.
- Live layer: `live.js` and `live.css`.
  - `tools/build.mjs` adds them to `dist/` only.
  - `live.js` sets `window.OneStyleLive`, and every live hook in `app.js` and `admin.js` is guarded by it.
- Preview only: `passwords.js` (the password rules; the Worker gets its own copy at build time) and `accounts-demo.js` gives the GitHub Pages preview shopper accounts kept in the visitor's browser (sign up, sign in, profile, password, My orders, a reset link shown on screen, a demo account).
  - It sets `window.OneStylePreviewAccounts`; `app.js` uses it through `acct` (header and menu link, `#/account` and `#/reset/` routes, checkout prefill, the order's `account`).
  - It does nothing on the live site or from disk (file://), and `tools/build.mjs` leaves it out of `dist/`. It borrows the account styles from `live.css`.
- Server: `worker/src/*.js`; schema `migrations/*.sql`; config `wrangler.jsonc`.
- Telegram: `worker/src/telegram.js` stores the bot connection in the private `telegram_settings` table. Never include its token in content, metadata responses, exports or logs. Order alerts run after the order commits and contain no customer contact details.
- Generated, never edited and never committed: `dist/` and `worker/src/generated/shop-rules.js`. The latter is built from `data.js` + `settings.js` + `passwords.js` + `legal.js`, so the server prices and cleans content with the storefront's own functions.

## Behaviour that must be kept

- **Prices:**
  - `unitPrice = startPrice + (ram - ramOptions[0]) * 9 + storageIndex * 75`.
  - The offer price applies only when below the base price.
  - Delivery: Amman fee, other governorates fee, 0 for pickup.
  - Money on the server is in fils (integers). The server recomputes every order total; the shopper's `totalFils` must match exactly.
- **Ordering:**
  - Off until the owner turns on `settings.checkout.ordersOn` in the admin. While off, checkout falls back to WhatsApp.
  - The same switch decides search indexing: robots, sitemap and meta robots.
- **Addresses:**
  - English at `/`, `/shop`, `/<category>`, `/devices/<slug>`; Arabic under `/ar`.
  - The slug comes from name + chip. A renamed public device keeps its old slug as a 301.
  - Hidden devices answer 404 with noindex.
  - Admin and reset pages stay on hash routes: `/#/admin`, `/#/reset/<token>`, `/ar#/reset/<token>`.
- **Passwords:**
  - PBKDF2-SHA-256 at 20,000 rounds (10 ms CPU limit on the free plan).
  - Minimums live in `passwords.js`, shared by the preview, the live forms and the Worker: shoppers 8 to 200 characters with at least one letter and not a common password; the admin 10 to 200. Old hashes keep verifying.
  - Do not change the round count without Jafar; check Metrics → CPU time first.
- **Sessions:**
  - `onestyle_admin` (Path=/api/admin, 12 h) and `onestyle_customer` (Path=/api, 7 days), both HttpOnly, Secure, SameSite=Strict.
  - Tokens are stored hashed. A generation counter ends older sessions after a password change or reset.
- **Reset by email:**
  - One-time, 30 minutes, token only after the `#`.
  - Forgot answers the same for known and unknown emails.
  - Admin links go only to `ADMIN_EMAIL`.
  - Hidden until `RESEND_API_KEY`, `MAIL_FROM` and `SITE_URL` exist.
- **Limits:**
  - At most 20 per line and 20 lines per order.
  - Orders: 5/hour and 20/day per IP (IPv6 grouped by /56), 100/hour and 1,000/day shop-wide.
  - Sign-up: 5/hour and 20/day per IP.
  - Daily email budget under Resend's free 100/day: order alerts 50, shopper resets 30, admin resets 6.
  - A new reset request keeps the two newest earlier links.
  - All rate limits live in the D1 `attempts` table.
- **Photos:** PNG/JPEG/WebP ≤ 1.5 MB, checked by magic bytes, stored in KV, served at `/api/photo/<id>`.
- **Line endings:** `app.js`, `admin.js` and `settings.js` use CRLF. Keep them, or the diff becomes the whole file.

## Changing things

- **Schema:** add a new migration file (`migrations/0002_….sql`); never edit an applied one. The deploy command applies migrations before the code goes live.
- **Secrets:** never in code, config, tests or commits.
  - Production values are set by Jafar in the Cloudflare dashboard.
  - `tests/local/test.env` holds local test values only.
- **Commits:** author `yallarideapp <227899290+yallarideapp@users.noreply.github.com>`, with no tool names in messages, code or files.
- **Pushing:** push only when Jafar asks, only to the repo he names.

## Tests (run before every push)

```sh
npm test                 # no server: pricing parity, slugs, content cleaning
npm run test:api         # orders + admin abuse tests on a fresh local Worker
npm run test:accounts    # shopper accounts and reset links
npm run test:telegram    # private bot settings and server alerts through a local stand-in
npm run test:browser     # full flow in a browser (Playwright)
npm run test:widths      # 320–1440 px, ar/en, no sideways scrolling
npm run test:preview     # the Pages preview's demo accounts in a browser (Playwright)
```

- `tests/local/run.sh` starts a fresh local D1/KV, the Worker on :8788 with `tests/local/test.env`, and an email stand-in on :8799, then stops them.
- It refuses to run if `.dev.vars` or `.env` exists.
- Also open the preview from disk (`index.html`) after changing shared files: it must behave as before.

## After a change

- Add a dated line to «سجل تعديلات Claude» (or a ChatGPT section) in `ONESTYLE-CONTEXT.md`: files, what changed, why, how it was tested.
- Update `Cloudflare-guide.md` if a step for Jafar changed.
