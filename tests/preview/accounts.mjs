
// The GitHub Pages preview's demo accounts, in a browser (run through tests/preview/run.sh).
// Needs Playwright: npm i -D playwright && npx playwright install chromium (or set PLAYWRIGHT / CHROMIUM_PATH).
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8813/';
const OUT = process.argv[3] || '.wrangler';
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const problems = []; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) problems.push(m); };
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => problems.push(`pageerror ${e.message}`)); p.on('console', (m) => { if (m.type() === 'error') problems.push(`console ${m.text()}`); });
const go = async (hash) => { await p.goto(`${BASE}${hash}`); await p.waitForSelector('#app header, #app .site-header, #app nav', { state: 'attached' }); await p.waitForTimeout(300); };
const text = async (sel) => (await p.locator(sel).first().innerText()).trim();
await go('#/');
if (await p.evaluate(() => window.StoreDemo.lang) !== 'ar') { await p.click('.lang-button'); await p.waitForTimeout(400); }
ok(await p.evaluate(() => window.StoreDemo.lang) === 'ar', 'preview switched to Arabic');
ok(await p.locator('.live-account-link').count() === 1, 'header shows the account icon');
ok(await p.locator('script[src^="accounts-demo.js"]').count() === 1 && await p.evaluate(() => !!window.OneStylePreviewAccounts), 'demo accounts are loaded');
await p.click('.live-account-link'); await p.waitForSelector('[data-acct="tab"]');
ok(/تسجيل الدخول|Sign in/.test(await text('.live-account h1')), 'account page opens signed out');
// create an account
await p.click('[data-acct="tab"][data-tab="create"]');
const reg = 'form[data-acct-form="register"]';
await p.fill(`${reg} [name=name]`, 'جعفر'); await p.fill(`${reg} [name=email]`, 'Jafar.Test@Example.com'); await p.fill(`${reg} [name=phone]`, '٠٧٩١٢٣٤٥٦٧');
await p.fill(`${reg} [name=password]`, 'short-pass'); await p.fill(`${reg} [name=repeat]`, 'short-pass'); await p.click(`${reg} [type=submit]`); await p.waitForTimeout(400);
ok(/16/.test(await text('.live-alert')), 'a 10-character password is refused');
await p.fill(`${reg} [name=password]`, 'onestyle-preview-pass-1'); await p.fill(`${reg} [name=repeat]`, 'onestyle-preview-pass-1'); await p.click(`${reg} [type=submit]`);
await p.waitForSelector('form[data-acct-form="profile"]');
ok((await text('.live-account .live-note[dir=ltr]')) === 'jafar.test@example.com', 'account made; email kept in lower case');
ok(await p.inputValue('form[data-acct-form="profile"] [name=phone]') === '0791234567', 'Arabic digits become 0791234567');
await p.screenshot({ path: `${OUT}/preview-account.png` });
// same email again (other case) from a second account attempt after sign-out
await p.click('[data-acct="logout"]'); await p.waitForSelector('[data-acct="tab"]');
await p.click('[data-acct="tab"][data-tab="create"]');
await p.fill(`${reg} [name=name]`, 'Other'); await p.fill(`${reg} [name=email]`, 'JAFAR.test@example.com');
await p.fill(`${reg} [name=password]`, 'another-preview-pass-2'); await p.fill(`${reg} [name=repeat]`, 'another-preview-pass-2'); await p.click(`${reg} [type=submit]`); await p.waitForTimeout(600);
ok(/مستعمل|in use/.test(await text('.live-alert')), 'the same email in another case is refused');
// sign in: wrong then right
await p.click('[data-acct="tab"][data-tab="signin"]');
const login = 'form[data-acct-form="login"]';
await p.fill(`${login} [name=email]`, 'jafar.test@example.com'); await p.fill(`${login} [name=password]`, 'wrong-password-123456'); await p.click(`${login} [type=submit]`); await p.waitForTimeout(600);
ok(/غلط|Wrong/.test(await text('.live-alert')), 'a wrong password is refused');
await p.fill(`${login} [name=email]`, 'jafar.test@example.com'); await p.fill(`${login} [name=password]`, 'onestyle-preview-pass-1'); await p.click(`${login} [type=submit]`);
await p.waitForSelector('form[data-acct-form="profile"]'); ok(true, 'signs in with the right password');
// order while signed in
const productId = await p.evaluate(() => window.StoreDemo.getAllProducts().find((x) => !x.hidden && x.availability !== 'unavailable').id);
await go(`#/product/${productId}`); await p.click('.add-button'); await p.waitForTimeout(300);
await p.evaluate(() => document.querySelector('[data-action="checkout"]') || document.querySelector('[data-action="bag"]').click());
await p.waitForSelector('[data-action="checkout"]'); await p.click('[data-action="checkout"]'); await p.waitForSelector('#checkout-form');
ok(await p.inputValue('#checkout-form [name=name]') === 'جعفر' && await p.inputValue('#checkout-form [name=phone]') === '0791234567', 'checkout fills in the account name and mobile');
ok(/داخل باسم|Signed in as/.test(await text('#checkout-form .modal-note')), 'checkout says who is signed in');
await p.click('#checkout-form [type=submit]'); await p.waitForSelector('.order-success code');
const orderId = await text('.order-success code');
await go('#/account'); await p.waitForSelector('.live-orders');
ok((await text('.live-orders strong')) === orderId && /جديد|New/.test(await text('.live-status')), `the order ${orderId} shows in My orders as New`);
// admin sees the account, changes the status
await go(`#/admin/order/${encodeURIComponent(orderId)}`); await p.waitForSelector('[data-admin-order-form]');
ok(/jafar\.test@example\.com/.test(await text('.admin-customer')), 'admin order shows the account email');
await p.selectOption('#admin-status-select', 'confirmed'); await p.click('[data-admin-order-form] [type=submit]'); await p.waitForTimeout(500);
await go('#/account'); await p.waitForSelector('.live-orders');
ok(/تأكد|Confirmed/.test(await text('.live-status')), 'the admin status shows in My orders');
// profile and password
const prof = 'form[data-acct-form="profile"]';
await p.fill(`${prof} [name=phone]`, '12345'); await p.click(`${prof} [type=submit]`); await p.waitForTimeout(400);
ok(/أردني|Jordanian/.test(await text('.live-alert')), 'a non-Jordanian mobile is refused');
await p.fill(`${prof} [name=name]`, 'جعفر القضاة'); await p.fill(`${prof} [name=phone]`, '0781234567'); await p.click(`${prof} [type=submit]`); await p.waitForTimeout(400);
ok(/انحفظت|saved/.test(await text('.live-success')) && await p.inputValue(`${prof} [name=name]`) === 'جعفر القضاة', 'profile saved');
await p.evaluate(() => { document.querySelector('.live-details').open = true; });
const pw = 'form[data-acct-form="password"]';
await p.fill(`${pw} [name=current]`, 'not-the-password-0000'); await p.fill(`${pw} [name=password]`, 'onestyle-preview-pass-2'); await p.fill(`${pw} [name=repeat]`, 'onestyle-preview-pass-2'); await p.click(`${pw} [type=submit]`); await p.waitForTimeout(700);
ok(/الحالية|current/.test(await text('.live-alert')), 'password change needs the current password');
await p.evaluate(() => { document.querySelector('.live-details').open = true; });
await p.fill(`${pw} [name=current]`, 'onestyle-preview-pass-1'); await p.fill(`${pw} [name=password]`, 'onestyle-preview-pass-2'); await p.fill(`${pw} [name=repeat]`, 'onestyle-preview-pass-2'); await p.click(`${pw} [type=submit]`); await p.waitForTimeout(900);
ok(/تغيّرت|changed/.test(await text('.live-success')), 'password changed');
// a second tab signed in before the change is signed out
await p.click('[data-acct="logout"]'); await p.waitForSelector('[data-acct="tab"]');
await p.fill(`${login} [name=email]`, 'jafar.test@example.com'); await p.fill(`${login} [name=password]`, 'onestyle-preview-pass-1'); await p.click(`${login} [type=submit]`); await p.waitForTimeout(700);
ok(/غلط|Wrong/.test(await text('.live-alert')), 'the old password no longer works');
// forgot password: the link shows on screen
await p.click('[data-acct="tab"][data-tab="forgot"]');
await p.fill('form[data-acct-form="forgot"] [name=email]', 'jafar.test@example.com'); await p.click('form[data-acct-form="forgot"] [type=submit]'); await p.waitForSelector('.live-success a');
const link = await p.getAttribute('.live-success a', 'href');
ok(/#\/reset\/[0-9a-f]{64}$/.test(link), 'forgot shows the reset link on screen (demo)');
await p.click('.live-success a'); await p.waitForSelector('form[data-acct-form="reset"]');
ok(/#\/reset\/$/.test(p.url()), 'the token is taken out of the address bar');
await p.fill('form[data-acct-form="reset"] [name=password]', 'onestyle-preview-pass-3'); await p.fill('form[data-acct-form="reset"] [name=repeat]', 'onestyle-preview-pass-3'); await p.click('form[data-acct-form="reset"] [type=submit]');
await p.waitForSelector('form[data-acct-form="profile"]');
ok(/#\/account$/.test(p.url()) && /تغيّرت|changed/.test(await text('.live-success')), 'new password saved and signed in');
await p.goto(`${BASE}${link.replace(/^.*#/, '#')}`); await p.waitForSelector('.live-account'); await p.waitForTimeout(300);
const used = await p.locator('form[data-acct-form="reset"]').count();
if (used) { await p.fill('form[data-acct-form="reset"] [name=password]', 'onestyle-preview-pass-4'); await p.fill('form[data-acct-form="reset"] [name=repeat]', 'onestyle-preview-pass-4'); await p.click('form[data-acct-form="reset"] [type=submit]'); await p.waitForTimeout(700); }
ok(/انتهى|expired/.test(await text('.live-alert')), 'a used reset link is refused');
// guest order and the sample account
await go('#/account'); if (await p.locator('[data-acct="logout"]').count()) { await p.click('[data-acct="logout"]'); await p.waitForSelector('[data-acct="tab"]'); }
await go(`#/product/${productId}`); await p.click('.add-button'); await p.waitForTimeout(300);
await p.evaluate(() => document.querySelector('[data-action="bag"]').click()); await p.waitForSelector('[data-action="checkout"]'); await p.click('[data-action="checkout"]'); await p.waitForSelector('#checkout-form');
ok(/سجّل الدخول|Sign in to keep/.test(await text('#checkout-form .modal-note')), 'signed out: checkout offers sign in or guest');
await p.click('#checkout-form [type=submit]'); await p.waitForSelector('.order-success code'); const guestId = await text('.order-success code');
await go(`#/admin/order/${encodeURIComponent(guestId)}`); await p.waitForSelector('[data-admin-order-form]');
ok(/ضيف|Guest/.test(await text('.admin-customer')), 'admin shows a guest order as guest');
await go('#/account'); await p.click('[data-acct="sample"]'); await p.waitForSelector('form[data-acct-form="profile"]');
ok((await text('.live-account .live-note[dir=ltr]')) === 'demo@onestyle.example' && /لسا ما في|No orders/.test(await text('.live-orders, .live-grid .live-card:last-child .live-note')), 'the demo account opens with no orders (the guest order is not linked)');
// English
ok(/حسابي/.test(await text('.live-account h1')), 'Arabic account page');
await p.click('.lang-button'); await p.waitForTimeout(400);
ok(/My account/.test(await text('.live-account h1')) && /My orders/.test(await p.locator('.live-account').innerText()), 'English account page');
await p.screenshot({ path: `${OUT}/preview-account-en.png` });
await b.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join("\n")}` : "ALL PASSED");
if (problems.length) process.exitCode = 1;
