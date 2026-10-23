---
name: cloudflare-free-backend
description: "Build or connect a site's real backend on Cloudflare's free plan using Workers, D1 and KV, with GitHub deployments, shared admin content, uploads, accounts and server-side order alerts as the site requires. Use when Jafar asks for backend/server connection or Cloudflare launch; not for ordinary frontend-only edits."
---

# Cloudflare backend and owner handover

Jafar's chosen default for taking his sites live is Cloudflare Workers + Static Assets + D1 + KV, with GitHub deploying the source. Keep the free/no-card goal; verify current official limits before promising capacity or cost. A paid domain is separate and optional before launch on `workers.dev`. Do not switch providers or add paid services without his request.

When asked to connect a site to a server, complete the backend, its admin controls, integration setup, tests and owner guide. Adapt this workflow to the site's actual features; a simple information site does not need a shop's accounts or checkout. Do not stop at a frontend mockup or a plan.

## Establish the right source

- Read the project's `AGENTS.md` and context/change log. Inspect its current frontend, storage, routes, workflows, backend and API contracts before choosing changes. Pull/rebase before edits when the checkout is clean; preserve others' unfinished work.
- Identify the exact owner repository, production domain and preview repository. Prefer a private source repository in the shop's account. An existing public demo can remain separate. They do **not** synchronize automatically: only copy explicitly requested changes to the named destination.
- Repository ownership, collaborator access, authenticated GitHub account and commit author are different things. Follow the current project's approved author identity. Do not hardcode Jafar's account into a new owner's project or rewrite history without a specific request.
- Preserve the existing build/framework, line endings and business behavior. Edit source, not generated bundles, `dist/` or generated server rules.

## Build the complete live layer

- One Worker serves static assets and the API. D1 stores transactional data, published content, users, sessions and rate limits; KV stores uploaded image bytes. Never store orders in KV.
- Keep the demo and live adapters separate. Portable local demos and public previews must keep their existing behavior; a preview must not silently use the production database or integration keys. Publish an explicit storefront-only file list for public Pages previews.
- Reuse price, variant, content-cleaning and password rules across frontend and server. The server validates input and recomputes prices, fees, availability and totals in integer minor currency units. Commit an order and its unique number atomically; retries with the same idempotency key return the same order.
- Connect all existing admin features to shared storage: categories and images, product specifications and condition, used-device battery details when applicable, stock, appearance/hero controls and delivery settings. A new category must appear in storefront navigation/filtering and relevant admin choices from one data source. Preserve private stock counts and hidden products.
- Implement the site's required admin/shopper authentication, password changes, reset email, order history/status and privacy boundaries. Preserve approved password policies and hash compatibility; never quietly weaken them to meet CPU limits.
- Keep ordering disabled until the owner approves opening it when that is the site's policy. Preserve its WhatsApp fallback and indexing switch.
- Use real crawlable product/category URLs where the site supports them, language-specific routes, safe old-slug redirects, hidden-item 404s, sitemap and robots rules. Keep private admin/account/reset routes out of search.
- Make the first paint presentable without sacrificing the real HTML catalog or SEO. Bound startup/API/session waits, expose a retry path and handle missing scripts. A live API failure must never show sample inventory as if it were current stock.

Read [references/live-shop.md](references/live-shop.md) when implementing transactional/authentication behavior, photo uploads or startup. It records the tested OneStyle design and its project-specific limits; do not impose those numbers on unrelated sites.

## Owner-controlled integrations

For a shop requesting Telegram alerts, provide the complete **BotFather → admin connection → saved-order alert** flow, not a browser-only send button. Read [references/telegram.md](references/telegram.md) before implementing it.

The owner can create a bot on his phone, start it, paste its token into the authenticated admin panel, choose or enter the Chat ID, save, test, enable/disable and remove it. Orders send from the server after saving, even with the admin panel closed. Show safe connection/delivery status. Tell him what information the alert contains and whether retries exist.

Deployment secrets (setup code, Resend key, signing/encryption material) belong in Cloudflare runtime secrets. Owner-editable integration credentials may instead live in a dedicated private backend table accessible only through authenticated admin operations. Never put them in public settings/content, localStorage, customization exports, returned token values, logs or source control. The owner enters real values in the dashboard/admin; do not ask him to paste them in chat.

For email, keep order notification delivery separate from password resets. Use a verified sender/domain, bounded requests and daily budgets. A successful API response is not proof that the owner received an email or Telegram message: confirm real arrival during authorized setup.

## Photos

- Optimize built-in raster photography to WebP when appropriate, preserving useful resolution and transparency; keep suitable vector logos/icons as SVG. Check actual file signatures before saying images are WebP.
- Inspect the upload pipeline separately. Accepting WebP does not mean JPG/PNG uploads are converted. Report the actual behavior; only add conversion when requested or needed by the site's agreed media policy.
- Enforce size and detected PNG/JPEG/WebP type on the server, reject mismatched or executable bytes, store the detected content type and serve with `nosniff` and appropriate caching. Never trust an extension or browser MIME alone.

## GitHub and Cloudflare deployment

- The shop owns its GitHub, Cloudflare and mail-provider accounts. Jafar/owner creates accounts and performs sign-in, password, MFA and billing steps. Guide the setup and automate the already-authorized technical work with available tools.
- Ignore secrets, `.env`, `.dev.vars`, `node_modules/`, `dist/` and `.wrangler/`; inspect the actual diff and publication contents before pushing. Tests contain only obvious local dummy credentials and fake services.
- Configure Workers Builds for the chosen production branch and exact repo. Match dashboard Worker name and `wrangler.jsonc`; use the correct project root and bindings.
- Typical build: `npm ci && npm run build`. Typical deploy script: `wrangler d1 migrations apply DB --remote && wrangler deploy`. Add new migrations; never edit an applied migration. Preserve dashboard variables as needed, such as `keep_vars` in an existing configuration.
- Runtime secrets differ from build variables. Preview/version deployments can share production D1/KV unless explicitly isolated: inspect bindings before testing writes or messages. Do not promise automatic isolated previews without configuring them.
- Confirm deployments succeed and check the actual site, bindings, routes, domain/TLS and order switch. Explain rollback, including database compatibility: reverting code does not undo a migration.
- Push/deploy only to the destination Jafar authorizes. Existing authorization remains valid; if it is missing, finish the code, tests and a reviewable preview first, then obtain explicit approval before publishing. Buying a domain or sending a client message needs its own authorization.

## Verification and delivery

- Run project-required pricing/content, order/admin, accounts/reset, integration and browser checks before a push. Use disposable local D1/KV and fake email/Telegram services; do not test against production by accident. Respect the environment's browser-tool rules.
- Exercise tampering, authorization/CSRF, body/type caps, invalid variants, concurrent orders/retries, conflict handling, token redaction, upload bytes and limits. For UI changes check Arabic/RTL, English, mobile/desktop widths and two sessions seeing a shared admin update.
- For a newly built Worker or substantial backend change, have an independent subagent review the affected server code when delegation is available; fix findings and retest. Do not turn small unrelated edits into a full security audit.
- Record exactly which suites passed and which were substituted or could not run. Verify portable previews when shared files change, if permitted. Do not claim an automated suite ran when only a focused browser check ran.
- After first real deployment inspect Cloudflare CPU/usage, particularly login/password hashing, before proposing changes. Never present local tests as proof of production CPU usage, real message delivery or a real iPhone test.
- Update the project's context log, `AGENTS.md` for lasting invariants, and its Arabic owner guide (`Cloudflare-guide.md`/existing equivalent). Include owner account/repo selection, D1/KV creation, bindings, migrations, runtime secrets, setup password, domain, mail, BotFather/admin connection, update/rollback and usage checks as applicable. Keep source archives free of secrets and generated/local files.
- Report the practical outcome, tests, pending owner actions and deployment state plainly. Distinguish “implemented locally,” “pushed,” “deployed,” “configured” and “real delivery confirmed.”

Authoritative references to recheck when relevant: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [static asset billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [KV limits](https://developers.cloudflare.com/kv/platform/limits/), [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/), [Telegram Bot API](https://core.telegram.org/bots/api).
