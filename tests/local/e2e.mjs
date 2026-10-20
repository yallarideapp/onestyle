// End-to-end on the local Worker (run through tests/local/run.sh): admin setup, ordering on, price and photo edit,
// shopper account, checkout from a second browser, order in admin, status in My orders,
// password resets by email (local stand-in), search pages, renamed address.
// Needs Playwright: npm i -D playwright && npx playwright install chromium (or set PLAYWRIGHT / CHROMIUM_PATH).
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const BASE = process.argv[2] || 'http://127.0.0.1:8788';
const OUT = process.argv[3] || process.env.ONESTYLE_OUT || '.wrangler';
const MAIL = process.argv[4] || process.env.ONESTYLE_MAIL || '.wrangler/test-mail.jsonl';
const CODE = 'test-setup-code-1234567890', PASS = 'onestyle-admin-pass-2026', PASS2 = 'onestyle-admin-pass-2027';
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const problems = [];
let finished = false;
process.on('exit', () => { if (!finished && problems.length) console.log(`\nPROBLEMS SO FAR:\n${problems.join('\n')}`); });
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) problems.push(m); };
const watch = (p, tag) => { p.on('pageerror', (e) => problems.push(`${tag} pageerror ${e.message}`)); p.on('console', (m) => { if (m.type() === 'error' && !/40[01349]|429/.test(m.text())) problems.push(`${tag} console ${m.text()}`); }); };
const mails = () => existsSync(MAIL) ? readFileSync(MAIL, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const linkIn = (mail) => (mail.body.text.match(/https?:\/\/\S+#\/(?:admin-)?reset\/[a-f0-9]{64}/) || [])[0];
const toastSaved = async (p) => p.waitForFunction(() => /Saved to the site|انحفظ على الموقع/.test(document.getElementById('toast')?.textContent || ''), null, { timeout: 10000 });

// ---------- admin ----------
const adminCtx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const admin = await adminCtx.newPage(); watch(admin, 'admin');
await admin.goto(`${BASE}/#/admin`); await admin.waitForSelector('form[data-live-form="admin-setup"]');
await admin.fill('input[name=code]', 'wrong-code-0000'); await admin.fill('input[name=password]', PASS); await admin.fill('input[name=repeat]', PASS);
await admin.click('form[data-live-form="admin-setup"] [type=submit]'); await admin.waitForSelector('.live-alert');
ok(/رمز|code/i.test(await admin.locator('.live-alert').innerText()), 'wrong setup code is refused');
await admin.fill('input[name=code]', CODE); await admin.fill('input[name=password]', 'short-password'); await admin.fill('input[name=repeat]', 'short-password');
await admin.click('form[data-live-form="admin-setup"] [type=submit]'); await admin.waitForTimeout(500);
ok(await admin.locator('form[data-live-form="admin-setup"]').count() === 1, 'a 14-character password is refused');
await admin.fill('input[name=password]', PASS); await admin.fill('input[name=repeat]', PASS);
await admin.click('form[data-live-form="admin-setup"] [type=submit]');
await admin.waitForSelector('.admin-shell'); ok(true, 'setup code + 16+ password opens the admin');
ok(await admin.locator('[data-live="admin-logout"]').count() === 1, 'admin shows a sign-out button');
// ordering on
await admin.goto(`${BASE}/#/admin/settings`); await admin.waitForSelector('form[data-admin-settings-form="checkout"]', { state: 'attached' });
await admin.evaluate(() => { const d = document.querySelector('form[data-admin-settings-form="checkout"]').closest('details'); if (d) d.open = true; });
ok(!(await admin.locator('input[name=ordersOn]').isChecked()), 'ordering starts off');
await admin.check('input[name=ordersOn]'); await admin.click('form[data-admin-settings-form="checkout"] [type=submit]');
await toastSaved(admin); ok(true, 'ordering switched on and published');
// price + photo on the first MacBook
await admin.goto(`${BASE}/#/admin/products`); await admin.waitForSelector('form[data-admin-product-form="macbook-pro-14-m1"]', { state: 'attached' });
const form = admin.locator('form[data-admin-product-form="macbook-pro-14-m1"]');
await admin.evaluate(() => { const f = document.querySelector('form[data-admin-product-form="macbook-pro-14-m1"]'); const d = f.closest('details'); if (d) d.open = true; });
ok(/\/devices\/macbook-pro-14-m1-pro/.test(await form.locator('.live-product-address').innerText()), 'device form shows its public address');
await form.locator('input[name=price]').fill('815');
const png = await admin.evaluate(async () => { const c = document.createElement('canvas'); c.width = 400; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#2469e8'; g.fillRect(40, 40, 320, 220); const blob = await new Promise((r) => c.toBlob(r, 'image/png')); return Array.from(new Uint8Array(await blob.arrayBuffer())); });
writeFileSync(`${OUT}/test-photo.png`, Buffer.from(png));
await form.locator('input[data-admin-image-upload="image"]').setInputFiles(`${OUT}/test-photo.png`);
await admin.waitForFunction(() => /^data:image\/png/.test(document.querySelector('form[data-admin-product-form="macbook-pro-14-m1"] input[name=image]')?.value || ''));
await form.locator('[type=submit]').first().click();
await toastSaved(admin); ok(true, 'price and photo saved to the site');
const content = await admin.evaluate(async () => (await fetch('/api/content')).json());
const mac = content.content.catalog.find((p) => p.id === 'macbook-pro-14-m1');
ok(mac.basePrice === 815 && /^api\/photo\/[a-f0-9]{32}$/.test(mac.image), `published: price ${mac.basePrice}, photo ${mac.image}`);
// stock: the one-tap toggle and the admin-only count, on the live server
const pubOf = async (id) => (await admin.evaluate(async () => (await fetch('/api/content', { cache: 'no-store' })).json())).content.catalog.find((p) => p.id === id);
await admin.waitForSelector('[data-admin-stock-toggle="macbook-pro-14-m3"]', { state: 'attached' });
for (let i = 0; i < 2 && (await pubOf('macbook-pro-14-m3')).availability !== 'unavailable'; i++) {
  const before = (await pubOf('macbook-pro-14-m3')).availability;
  await admin.click('[data-admin-stock-toggle="macbook-pro-14-m3"]');
  for (let k = 0; k < 40 && (await pubOf('macbook-pro-14-m3')).availability === before; k++) await admin.waitForTimeout(250);
}
ok((await pubOf('macbook-pro-14-m3')).availability === 'unavailable', 'stock toggle publishes Out of stock');
await admin.evaluate(() => { const d = document.querySelector('form[data-admin-product-form="macbook-pro-14-m1"]').closest('details'); if (d) d.open = true; });
await form.locator('input[name=stockCount]').fill('2'); await form.locator('[type=submit]').first().click();
let adminCount;
for (let k = 0; k < 40; k++) { adminCount = (await admin.evaluate(async () => (await fetch('/api/admin/content', { cache: 'no-store' })).json())).content.catalog.find((p) => p.id === 'macbook-pro-14-m1').stockCount; if (adminCount === 2) break; await admin.waitForTimeout(250); }
const pubMac = await pubOf('macbook-pro-14-m1');
ok(adminCount === 2 && !('stockCount' in pubMac) && pubMac.basePrice === 815, `stock count kept for the admin only (admin ${adminCount}, public ${'stockCount' in pubMac ? 'has it' : 'none'})`);
ok(await admin.waitForSelector('[data-admin-stock="macbook-pro-14-m1"] .admin-stock-pill.is-low', { state: 'attached', timeout: 5000 }).then(() => true, () => false), 'admin marks a count of 2 as Low stock');

// ---------- shopper in a second browser ----------
const shopCtx = await b.newContext({ viewport: { width: 390, height: 844 } });
const soldOut = await shopCtx.newPage(); watch(soldOut, 'shop-stock');
await soldOut.goto(`${BASE}/devices/macbook-pro-14-m3`); await soldOut.waitForSelector('.add-button');
ok(await soldOut.locator('.add-button').isDisabled() && /Out of stock|غير متوفر/.test(await soldOut.locator('.add-button').innerText()), 'out-of-stock device: the shopper cannot add it to the bag');
await soldOut.close();
const shop = await shopCtx.newPage(); watch(shop, 'shop');
await shop.goto(`${BASE}/devices/macbook-pro-14-m1-pro`); await shop.waitForSelector('#detail-price');
ok(/815/.test(await shop.locator('#detail-price').innerText()), 'second browser sees the new price');
const imgSrc = await shop.locator('#detail-art img.device-photo').getAttribute('src');
ok(/^\/api\/photo\/[a-f0-9]{32}$/.test(imgSrc || ''), `uploaded photo served from ${imgSrc}`);
ok(await shop.evaluate(() => { const i = document.querySelector('#detail-art img.device-photo'); return i.complete && i.naturalWidth > 0; }), 'uploaded photo loads on a deep address');
await shop.locator('.size-options').first().locator('button').nth(1).click();
const chosen = (await shop.locator('#detail-price').innerText()).trim();
await shop.click('[data-action="add"]'); await shop.waitForTimeout(400);
await shop.goto(`${BASE}/devices/usb-c-charger-20-w`); await shop.waitForSelector('[data-action="add"]'); await shop.click('[data-action="add"]'); await shop.waitForTimeout(300);
// account
await shop.goto(`${BASE}/account`); await shop.waitForSelector('[data-live="tab"]');
await shop.click('[data-live="tab"][data-tab="create"]');
const email = `shopper.${Date.now()}@example.test`;
await shop.fill('form[data-live-form="register"] input[name=name]', 'Test Shopper'); await shop.fill('form[data-live-form="register"] input[name=email]', email);
await shop.fill('form[data-live-form="register"] input[name=phone]', '٠٧٩١٢٣٤٥٦٧'); await shop.fill('form[data-live-form="register"] input[name=password]', 'shopper-long-password-1'); await shop.fill('form[data-live-form="register"] input[name=repeat]', 'shopper-long-password-1');
await shop.click('form[data-live-form="register"] [type=submit]'); await shop.waitForSelector('[data-live="logout"]');
ok(true, 'shopper creates an account (Arabic digits in the mobile accepted)');
// checkout
await shop.evaluate(() => document.querySelector('[data-action="bag"]').click()); await shop.waitForSelector('[data-action="checkout"]');
await shop.click('[data-action="checkout"]'); await shop.waitForSelector('form[data-live-form="checkout"]');
ok(await shop.locator('form[data-live-form="checkout"] input[name=name]').inputValue() === 'Test Shopper', 'checkout fills the name from the account');
await shop.fill('form[data-live-form="checkout"] textarea[name=address]', 'Gardens, test street 4');
await shop.selectOption('form[data-live-form="checkout"] select[name=city]', 'Other');
const total = (await shop.locator('#live-total').innerText()).trim();
await shop.waitForTimeout(3100);
await shop.click('form[data-live-form="checkout"] [type=submit]');
await shop.waitForSelector('.order-success code', { timeout: 10000 });
const number = (await shop.locator('.order-success code').innerText()).trim();
ok(/^OS-\d{4}$/.test(number), `order placed: ${number}, total ${total}, chosen ${chosen}`);
await shop.screenshot({ path: `${OUT}/shop-done.png` });

// ---------- order in admin ----------
await admin.goto(`${BASE}/#/admin/orders`); await admin.waitForTimeout(800); await admin.reload();
await admin.waitForSelector(`text=${number}`, { timeout: 10000 }); ok(true, 'order appears in the admin');
await admin.goto(`${BASE}/#/admin/order/${number}`); await admin.waitForSelector('form[data-admin-order-form]');
ok(/Test Shopper/.test(await admin.locator('.admin-customer').innerText()), 'order shows the customer');
await admin.selectOption('#admin-status-select', 'confirmed'); await admin.click('form[data-admin-order-form] [type=submit]'); await admin.waitForTimeout(1200);
await shop.goto(`${BASE}/account`); await shop.waitForSelector('.live-orders', { timeout: 10000 });
ok(/Confirmed|تأكد/.test(await shop.locator('.live-orders').innerText()), 'shopper sees the new status in My orders');

// ---------- password reset by email ----------
await shop.click('[data-live="logout"]'); await shop.waitForSelector('[data-live="tab"]');
await shop.click('[data-live="tab"][data-tab="forgot"]'); await shop.fill('form[data-live-form="forgot"] input[name=email]', email);
const before = mails().length;
await shop.click('form[data-live-form="forgot"] [type=submit]'); await shop.waitForSelector('.live-success');
await shop.waitForTimeout(1500);
const resetMail = mails().slice(before).find((m) => m.body.to[0] === email);
ok(!!resetMail && !/Test Shopper/.test(resetMail.body.html), 'reset email sent, with no text the shopper typed');
const link = resetMail && linkIn(resetMail);
await shop.goto(link.replace(/^https?:\/\/[^/]+/, BASE)); await shop.waitForSelector('form[data-live-form="reset"]');
ok(!/[a-f0-9]{64}/.test(await shop.evaluate(() => location.href)), 'the token is taken out of the address');
await shop.fill('form[data-live-form="reset"] input[name=password]', 'shopper-new-password-22'); await shop.fill('form[data-live-form="reset"] input[name=repeat]', 'shopper-new-password-22');
await shop.click('form[data-live-form="reset"] [type=submit]'); await shop.waitForSelector('[data-live="logout"]');
ok(true, 'reset link sets a new password and signs in');
await shop.goto(link.replace(/^https?:\/\/[^/]+/, BASE)); await shop.waitForSelector('form[data-live-form="reset"]');
await shop.fill('form[data-live-form="reset"] input[name=password]', 'shopper-third-password-3'); await shop.fill('form[data-live-form="reset"] input[name=repeat]', 'shopper-third-password-3');
await shop.click('form[data-live-form="reset"] [type=submit]'); await shop.waitForSelector('.live-alert');
ok(true, 'the same link does not work twice');

// admin reset
const admin2 = await (await b.newContext()).newPage(); watch(admin2, 'admin2');
await admin2.goto(`${BASE}/#/admin`); await admin2.waitForSelector('form[data-live-form="admin-login"]');
await admin2.click('[data-live="admin-view"][data-view="forgot"]'); const before2 = mails().length;
await admin2.click('form[data-live-form="admin-forgot"] [type=submit]'); await admin2.waitForSelector('.live-success'); await admin2.waitForTimeout(1500);
const adminMail = mails().slice(before2).find((m) => /admin-reset/.test(m.body.text));
ok(!!adminMail && adminMail.body.to[0] === 'owner@example.test', 'admin reset goes only to ADMIN_EMAIL');
await admin2.goto(linkIn(adminMail).replace(/^https?:\/\/[^/]+/, BASE)); await admin2.waitForSelector('form[data-live-form="admin-reset"]');
await admin2.fill('form[data-live-form="admin-reset"] input[name=password]', PASS2); await admin2.fill('form[data-live-form="admin-reset"] input[name=repeat]', PASS2);
await admin2.click('form[data-live-form="admin-reset"] [type=submit]'); await admin2.waitForSelector('.admin-shell');
ok(true, 'admin reset link opens the admin with the new password');
ok(/\/ar#\/admin-reset\//.test(linkIn(adminMail)) && await admin2.evaluate(() => document.documentElement.lang) === 'ar', 'Arabic reset email opens the page in Arabic');
await admin.reload(); await admin.waitForSelector('form[data-live-form="admin-login"]', { timeout: 10000 }).catch(() => {});
ok(await admin.locator('form[data-live-form="admin-login"]').count() === 1, 'the old admin session ended after the reset');

// ---------- search pages ----------
const page = await (await fetch(`${BASE}/devices/macbook-pro-14-m1-pro`)).text();
ok(/<meta name="robots" content="index,follow">/.test(page) && /"@type":"Product"/.test(page) && /rel="canonical" href="[^"]+\/devices\/macbook-pro-14-m1-pro"/.test(page) && /hreflang="ar"/.test(page), 'device page: indexable, Product data, canonical, hreflang');
ok(/<h1>MacBook Pro 14″ · M1 Pro<\/h1>/.test(page) && /815 JOD/.test(page), 'device page has its name and price in the HTML');
const sitemap = await fetch(`${BASE}/sitemap.xml`); const map = await sitemap.text();
ok(sitemap.status === 200 && map.includes('/devices/usb-c-charger-20-w') && map.includes('/ar/devices/'), 'sitemap lists devices in both languages');
// rename → old address redirects
await admin2.goto(`${BASE}/#/admin/products`); await admin2.click('[data-admin-category="iphone"]'); await admin2.waitForSelector('form[data-admin-product-form="iphone-15"]', { state: 'attached' });
await admin2.evaluate(() => { const f = document.querySelector('form[data-admin-product-form="iphone-15"]'); const d = f.closest('details'); if (d) d.open = true; });
const f2 = admin2.locator('form[data-admin-product-form="iphone-15"]');
await f2.locator('input[name=name]').fill('iPhone 15 Plus'); await f2.locator('[type=submit]').first().click(); await toastSaved(admin2);
const moved = await fetch(`${BASE}/devices/iphone-15-a16-bionic`, { redirect: 'manual' });
ok(moved.status === 301 && /\/devices\/iphone-15-plus-a16-bionic$/.test(moved.headers.get('location')), `renamed device: old address ${moved.status} → ${moved.headers.get('location')}`);
const gone = await fetch(`${BASE}/devices/not-a-device`); ok(gone.status === 404 && /noindex/.test(await gone.text()), 'unknown device: 404 + noindex');

await admin2.click('[data-live="admin-logout"]'); await admin2.waitForSelector('form[data-live-form="admin-login"]');
ok(true, 'admin signs out');
await b.close();
finished = true;
console.log(problems.length ? `\nPROBLEMS:\n${problems.join('\n')}` : '\nALL PASSED');
process.exit(problems.length ? 1 : 0);
