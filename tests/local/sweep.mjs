// Horizontal overflow on the live pages at phone to desktop widths, Arabic and English.
// Needs Playwright: npm i -D playwright && npx playwright install chromium (or set PLAYWRIGHT / CHROMIUM_PATH).
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8788', OUT = process.argv[3] || process.env.ONESTYLE_OUT || '.wrangler';
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const widths = [320, 360, 390, 430, 768, 1024, 1280, 1440];
const bad = []; const errs = [];
// one admin + one signed-in shopper for the private pages
const setup = await (await b.newContext()).newPage();
await setup.goto(`${BASE}/#/admin`); await setup.waitForSelector('form[data-live-form="admin-setup"]');
await setup.fill('input[name=code]', 'test-setup-code-1234567890'); await setup.fill('input[name=password]', 'onestyle-admin-pass-2026'); await setup.fill('input[name=repeat]', 'onestyle-admin-pass-2026');
await setup.click('form[data-live-form="admin-setup"] [type=submit]'); await setup.waitForSelector('.admin-shell');
await setup.evaluate(async () => { const r = await fetch('/api/admin/content'); const j = await r.json(); j.content.settings.checkout.ordersOn = true; await fetch('/api/admin/content', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseVersion: j.version, content: j.content }) }); });
const adminState = await setup.context().storageState();
const shopper = await (await b.newContext()).newPage();
await shopper.goto(`${BASE}/account`); await shopper.click('[data-live="tab"][data-tab="create"]');
await shopper.fill('form[data-live-form="register"] input[name=name]', 'محمد الأحمد'); await shopper.fill('form[data-live-form="register"] input[name=email]', `w${Date.now()}@example.test`);
await shopper.fill('form[data-live-form="register"] input[name=password]', 'sweep-long-password-1'); await shopper.fill('form[data-live-form="register"] input[name=repeat]', 'sweep-long-password-1');
await shopper.check('form[data-live-form="register"] input[name=agree]'); await shopper.click('form[data-live-form="register"] [type=submit]'); await shopper.waitForSelector('[data-live="logout"]');
const shopState = await shopper.context().storageState();
const pages = [
  ['home', '/', null], ['shop', '/shop', null], ['device', '/devices/macbook-pro-14-m1-pro', null], ['category', '/iphone', null],
  ['account-out', '/account', null], ['account-in', '/account', shopState], ['checkout', '/devices/iphone-15-a16-bionic', shopState, 'checkout'],
  ['admin-gate', '/#/admin', null], ['admin-products', '/#/admin/products', adminState], ['admin-orders', '/#/admin/orders', adminState], ['reset', '/#/reset/' + 'a'.repeat(64), null],
];
for (const lang of ['en', 'ar']) {
  for (const [name, path, state, action] of pages) {
    const ctx = await b.newContext({ storageState: state || undefined, viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(`${lang} ${name} ${e.message}`));
    const url = lang === 'ar' && !path.startsWith('/#') ? `${BASE}/ar${path === '/' ? '' : path}` : `${BASE}${path}`;
    if (lang === 'ar' && path.startsWith('/#')) { await p.goto(`${BASE}/ar`); await p.waitForTimeout(500); }
    await p.goto(url); await p.waitForTimeout(900);
    if (lang === 'ar' && path.startsWith('/#') && (await p.evaluate(() => document.documentElement.lang)) !== 'ar') { await p.click('[data-action="language"]').catch(() => {}); await p.waitForTimeout(400); }
    if (action === 'checkout') { await p.click('[data-action="add"]'); await p.waitForTimeout(300); await p.evaluate(() => document.querySelector('[data-action="bag"]').click()); await p.waitForSelector('[data-action="checkout"]'); await p.click('[data-action="checkout"]'); await p.waitForSelector('form[data-live-form="checkout"]'); }
    for (const w of widths) {
      await p.setViewportSize({ width: w, height: 844 }); await p.waitForTimeout(150);
      const o = await p.evaluate(() => { const vw = document.documentElement.clientWidth; const wide = [...document.querySelectorAll('body *')].filter((el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && (r.right > vw + 1 || r.left < -1) && cs.position !== 'fixed' && !el.closest('[aria-hidden="true"], .live-hp, .marquee, .rail, .scroller, [data-scroll]') && !el.closest('.admin-table-wrap, .shop-filters, .chip-row, .tabs-scroll'); }).slice(0, 3).map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`); return { sw: document.documentElement.scrollWidth, vw, wide }; });
      if (o.sw > o.vw + 1) bad.push(`${lang} ${name} @${w}: page scrolls sideways (${o.sw} > ${o.vw}) ${o.wide.join(' ')}`);
      if ([320, 390, 1280].includes(w)) await p.screenshot({ path: `${OUT}/sweep-${lang}-${name}-${w}.png`, fullPage: false });
    }
    await ctx.close();
  }
}
console.log(bad.length ? bad.join('\n') : 'no sideways scrolling', '\nerrors', errs.length, errs.slice(0, 5).join('\n'));
await b.close();
