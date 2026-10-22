// One Style preview (GitHub Pages): shopper accounts kept in this browser only, so the owner can try
// signing up, signing in, My orders and a password reset before the live site exists.
// The live site has real accounts on the server (live.js); this file is left out of its build and
// does nothing there. Opened from disk (file://), the preview has no accounts, as before.
(() => {
  'use strict';
  if (window.OneStyleLive || !/^https?:$/.test(location.protocol) || !window.isSecureContext || !(window.crypto && crypto.subtle)) return;

  const KEY = 'onestyle.preview-accounts.v1';
  const MAX_CUSTOMERS = 100, ROUNDS = 100000, RESET_MINUTES = 30, PAGE = 50;
  const SAMPLE_EMAIL = 'demo@onestyle.example';
  let app = null;                                   // from app.js: render, lang, money, getOrders
  const ui = { tab: 'signin', error: '', ok: '', link: '', busy: false, shown: PAGE, token: '' };

  // ---------- small helpers ----------
  const lang = () => (app ? app.lang() : 'ar');
  const t = (ar, en) => (lang() === 'ar' ? ar : en);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const randomHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
  const fromHex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
  const sha256 = async (text) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  async function hashPassword(password, salt, iterations) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(salt), iterations }, key, 256));
  }
  const sameText = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
  // Same field rules as the live server.
  const cleanText = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const cleanEmail = (v) => { const e = String(v ?? '').trim().toLowerCase(); return e.length <= 254 && /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null; };
  function cleanMobile(value) {
    const digits = String(value || '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[^\d+]/g, '');
    let local = digits;
    if (local.startsWith('+962')) local = '0' + local.slice(4);
    else if (local.startsWith('00962')) local = '0' + local.slice(5);
    else if (local.startsWith('962')) local = '0' + local.slice(3);
    if (local.startsWith('00')) local = local.slice(1);
    if (/^7\d{8}$/.test(local)) local = '0' + local;
    return /^07[789]\d{7}$/.test(local) ? local : null;
  }
  // Same rules as the live site (passwords.js): 8+ characters with a letter, not a common password.
  const passwordProblem = (p) => window.OneStylePasswords ? window.OneStylePasswords.customerProblem(p) : (typeof p === 'string' && p.length >= 8 && p.length <= 200 && /\p{L}/u.test(p) ? null : 'weak-password');

  // ---------- storage (this browser only) ----------
  const empty = () => ({ v: 1, customers: [], session: null, resets: [] });
  const isHex = (v, n) => typeof v === 'string' && v.length === n && /^[0-9a-f]+$/.test(v);
  const validCustomer = (c) => c && isHex(c.id, 32) && typeof c.email === 'string' && typeof c.name === 'string' && typeof c.phone === 'string' && isHex(c.salt, 32) && isHex(c.hash, 64) && Number.isInteger(c.iterations) && Number.isInteger(c.generation);
  function read() {
    let raw;
    try { raw = localStorage.getItem(KEY); } catch { return { broken: 'storage' }; }
    if (!raw) return empty();
    try {
      const s = JSON.parse(raw);
      if (s && s.v === 1 && Array.isArray(s.customers) && s.customers.length <= MAX_CUSTOMERS && s.customers.every(validCustomer) && Array.isArray(s.resets)) return s;
    } catch {}
    return { broken: 'data' };
  }
  // Writes wait for each other across tabs, and always start from the newest saved copy.
  async function write(change) {
    if (!(navigator.locks && navigator.locks.request)) throw code('storage-unavailable');
    return navigator.locks.request(KEY, async () => {
      const s = read(); if (s.broken) throw code('broken');
      const result = await change(s);
      const now = Date.now(); s.resets = s.resets.filter((r) => r.expires > now);
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { throw code('storage-unavailable'); }
      return result;
    });
  }
  const code = (c) => Object.assign(new Error(c), { code: c });
  function current() {
    const s = read(); if (s.broken || !s.session) return null;
    const c = s.customers.find((x) => x.id === s.session.id);
    return c && c.generation === s.session.generation ? c : null;
  }

  const messages = () => ({
    'bad-name': t('اكتب اسم من حرفين لـ 80 حرف.', 'Enter a name of 2 to 80 characters.'),
    'bad-email': t('الإيميل مش صحيح.', 'That email is not valid.'),
    'bad-phone': t('رقم الموبايل لازم يكون أردني، مثل 0791234567.', 'Use a Jordanian mobile number, like 0791234567.'),
    'weak-password': t('كلمة السر لازم تكون 8 خانات أو أكثر، وفيها حرف واحد على الأقل.', 'The password needs at least 8 characters, including at least one letter.'),
    'common-password': t('كلمة السر هاي مشهورة وسهل حدا يخمّنها. اختار غيرها.', 'That password is too common and easy to guess. Choose another one.'),
    'mismatch': t('كلمتين السر مش متطابقات.', 'The passwords do not match.'),
    'email-in-use': t('الإيميل مستعمل. سجّل دخول أو استعمل إيميل ثاني.', 'That email is in use. Sign in or use another email.'),
    'bad-credentials': t('الإيميل أو كلمة السر غلط.', 'Wrong email or password.'),
    'bad-current': t('كلمة السر الحالية غلط.', 'The current password is wrong.'),
    'full': t('وصلنا لحد الحسابات على هذا المتصفح (100).', 'This browser already holds the most demo accounts (100).'),
    'reset-expired': t('الرابط انتهى أو انستعمل. اطلب رابط جديد.', 'This link has expired or was already used. Ask for a new one.'),
    'storage-unavailable': t('هذا المتصفح ما بيسمح بحفظ الحسابات. جرّب متصفح ثاني أو نافذة عادية.', 'This browser does not allow saving accounts. Try another browser or a normal window.'),
    'broken': t('بيانات الحسابات على هذا المتصفح تالفة.', 'The account data in this browser is damaged.'),
  });
  const message = (c) => messages()[c] || t('صار خطأ. جرّب كمان مرة.', 'Something went wrong. Please try again.');

  // ---------- actions ----------
  async function register(f) {
    const name = cleanText(f.name, 80), email = cleanEmail(f.email), phoneText = cleanText(f.phone, 20), phone = phoneText ? cleanMobile(phoneText) : '';
    if (name.length < 2) throw code('bad-name');
    if (!email) throw code('bad-email');
    if (phone === null) throw code('bad-phone');
    if (passwordProblem(f.password)) throw code(passwordProblem(f.password));
    if (f.password !== f.repeat) throw code('mismatch');
    const salt = randomHex(16), hash = await hashPassword(f.password, salt, ROUNDS);
    await write((s) => {
      if (s.customers.some((c) => c.email === email)) throw code('email-in-use');
      if (s.customers.length >= MAX_CUSTOMERS) throw code('full');
      const now = new Date().toISOString(), c = { id: randomHex(16), email, name, phone, salt, hash, iterations: ROUNDS, generation: 1, createdAt: now, updatedAt: now };
      s.customers.push(c); s.session = { id: c.id, generation: 1 };
    });
  }
  async function login(f) {
    const email = cleanEmail(f.email), s = read();
    if (s.broken) throw code('broken');
    const c = email && s.customers.find((x) => x.email === email);
    // An unknown email still costs one hash, and answers like a wrong password.
    const hash = await hashPassword(String(f.password || ''), c ? c.salt : '00'.repeat(16), c ? c.iterations : ROUNDS);
    if (!c || !sameText(hash, c.hash)) throw code('bad-credentials');
    await write((s2) => { const x = s2.customers.find((y) => y.id === c.id); if (!x) throw code('bad-credentials'); s2.session = { id: x.id, generation: x.generation }; s2.resets = s2.resets.filter((r) => r.id !== x.id); });
  }
  async function saveProfile(f) {
    const name = cleanText(f.name, 80), phoneText = cleanText(f.phone, 20), phone = phoneText ? cleanMobile(phoneText) : '';
    if (name.length < 2) throw code('bad-name');
    if (phone === null) throw code('bad-phone');
    const me = current(); if (!me) throw code('signed-out');
    await write((s) => { const c = s.customers.find((x) => x.id === me.id); if (!c) throw code('signed-out'); c.name = name; c.phone = phone; c.updatedAt = new Date().toISOString(); });
  }
  async function changePassword(f) {
    const me = current(); if (!me) throw code('signed-out');
    if (!sameText(await hashPassword(String(f.current || ''), me.salt, me.iterations), me.hash)) throw code('bad-current');
    if (passwordProblem(f.password)) throw code(passwordProblem(f.password));
    if (f.password !== f.repeat) throw code('mismatch');
    await setPassword(me.id, me.generation, f.password);
  }
  async function setPassword(id, generation, password) {
    const salt = randomHex(16), hash = await hashPassword(password, salt, ROUNDS);
    await write((s) => {
      const c = s.customers.find((x) => x.id === id);
      if (!c || c.generation !== generation) throw code('reset-expired');
      Object.assign(c, { salt, hash, iterations: ROUNDS, generation: c.generation + 1, updatedAt: new Date().toISOString() });
      s.session = { id: c.id, generation: c.generation };          // other tabs signed in with the old password are signed out
      s.resets = s.resets.filter((r) => r.id !== c.id);
    });
  }
  async function forgot(f) {
    const email = cleanEmail(f.email); if (!email) throw code('bad-email');
    const token = randomHex(32), tokenHash = await sha256(token);
    const found = await write((s) => {
      const c = s.customers.find((x) => x.email === email); if (!c) return false;
      s.resets = s.resets.filter((r) => r.id !== c.id);
      s.resets.push({ hash: tokenHash, id: c.id, generation: c.generation, expires: Date.now() + RESET_MINUTES * 60000 });
      return true;
    });
    ui.link = found ? `${location.pathname}${location.search}#/reset/${token}` : '';
    ui.ok = found ? '' : t('ما في حساب بهالإيميل على هذا المتصفح.', 'There is no account with that email in this browser.');
  }
  async function reset(f) {
    if (passwordProblem(f.password)) throw code(passwordProblem(f.password));
    if (f.password !== f.repeat) throw code('mismatch');
    const tokenHash = isHex(ui.token, 64) ? await sha256(ui.token) : '';
    const r = read().resets?.find((x) => x.hash === tokenHash && x.expires > Date.now());
    if (!r) throw code('reset-expired');
    await setPassword(r.id, r.generation, f.password);
    ui.token = '';
  }
  async function sample() {
    // A sample account with a random password nobody knows: one click to see a signed-in account.
    const password = randomHex(24), salt = randomHex(16), hash = await hashPassword(password, salt, ROUNDS);
    await write((s) => {
      let c = s.customers.find((x) => x.email === SAMPLE_EMAIL);
      if (!c) {
        if (s.customers.length >= MAX_CUSTOMERS) throw code('full');
        const now = new Date().toISOString();
        c = { id: randomHex(16), email: SAMPLE_EMAIL, name: t('حساب العرض', 'Demo account'), phone: '0790000000', salt, hash, iterations: ROUNDS, generation: 1, createdAt: now, updatedAt: now };
        s.customers.push(c);
      }
      s.session = { id: c.id, generation: c.generation };
    });
  }

  // ---------- pages ----------
  const personIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';
  const route = () => location.hash.replace(/^#/, '') || '/';
  const field = (label, name, { type = 'text', value = '', auto = 'off', min = 0, max = 200, required = true, dir = '' } = {}) =>
    `<label class="live-field"><span>${esc(label)}</span><input name="${name}" type="${type}" value="${esc(value)}" autocomplete="${auto}"${min ? ` minlength="${min}"` : ''} maxlength="${max}"${required ? ' required' : ''}${dir ? ` dir="${dir}"` : ''}></label>`;
  const alerts = () => `${ui.error ? `<p class="live-alert" role="alert">${esc(ui.error)}</p>` : ''}${ui.ok ? `<p class="live-success" role="status">${esc(ui.ok)}</p>` : ''}`;
  const demoNote = () => `<p class="live-note">${t('نسخة العرض: الحسابات والطلبات بتنحفظ على هذا المتصفح بس، وما بتوصل للمحل. بالموقع الحقيقي بتنحفظ على السيرفر.', 'Demo copy: accounts and orders stay in this browser only and never reach the shop. On the live site they are kept on the server.')}</p>`;
  const busy = () => (ui.busy ? ' disabled' : '');
  const statusName = (s) => ({ new: t('جديد', 'New'), confirmed: t('تأكد', 'Confirmed'), shipped: t('طلع للتوصيل', 'Out for delivery'), delivered: t('انسلّم', 'Delivered'), cancelled: t('ملغي', 'Cancelled') }[s] || s);
  const dateText = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat(lang() === 'ar' ? 'ar-JO' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d); };
  const section = (inner) => `<section class="section-width live-account">${inner}</section>`;

  function accountPage() {
    const s = read(), me = current();
    const head = `<div class="page-heading"><div class="eyebrow">${t('حسابك', 'YOUR ACCOUNT')}</div><h1>${me ? t('حسابي', 'My account') : t('تسجيل الدخول', 'Sign in')}</h1></div>`;
    if (s.broken) return section(`${head}<div class="live-card"><p class="live-alert">${esc(message(s.broken === 'storage' ? 'storage-unavailable' : 'broken'))}</p>${s.broken === 'data' ? `<button class="button primary full" type="button" data-acct="wipe">${t('امسح بيانات الحسابات على هذا المتصفح', 'Clear the account data in this browser')}</button>` : ''}</div>`);
    if (!me) {
      if (ui.tab === 'forgot') {
        return section(`${head}<div class="live-card"><h2>${t('نسيت كلمة السر؟', 'Forgot your password?')}</h2><p class="live-note">${t('اكتب إيميل حسابك. بالموقع الحقيقي بيوصلك رابط على الإيميل، شغّال 30 دقيقة.', 'Enter your account email. On the live site a link arrives by email and works for 30 minutes.')}</p>
          <form data-acct-form="forgot" novalidate>${field(t('الإيميل', 'Email'), 'email', { type: 'email', auto: 'email', dir: 'ltr', max: 254 })}${alerts()}<button class="button primary full" type="submit"${busy()}>${t('ابعت الرابط', 'Send the link')}</button></form>
          ${ui.link ? `<div class="live-success"><p>${t('نسخة العرض: هاد الرابط كان رح يوصل على الإيميل.', 'Demo copy: this link would have arrived by email.')}</p><p><a href="${esc(ui.link)}" dir="ltr">${t('افتح رابط كلمة السر الجديدة', 'Open the new password link')}</a></p></div>` : ''}
          <button class="text-button" type="button" data-acct="tab" data-tab="signin">${t('رجوع لتسجيل الدخول', 'Back to sign in')}</button></div>`);
      }
      const create = ui.tab === 'create';
      const tabs = `<div class="live-tabs" role="tablist"><button type="button" role="tab" aria-selected="${!create}" data-acct="tab" data-tab="signin">${t('تسجيل الدخول', 'Sign in')}</button><button type="button" role="tab" aria-selected="${create}" data-acct="tab" data-tab="create">${t('حساب جديد', 'Create account')}</button></div>`;
      const form = create
        ? `<form data-acct-form="register" novalidate>${field(t('الاسم', 'Name'), 'name', { auto: 'name', min: 2, max: 80 })}${field(t('الإيميل', 'Email'), 'email', { type: 'email', auto: 'email', dir: 'ltr', max: 254 })}${field(t('رقم الموبايل (اختياري)', 'Mobile (optional)'), 'phone', { type: 'tel', auto: 'tel', dir: 'ltr', max: 20, required: false })}${field(t('كلمة السر (8 خانات أو أكثر وفيها حرف)', 'Password (8+ characters, with a letter)'), 'password', { type: 'password', auto: 'new-password', min: 8 })}${field(t('أعد كلمة السر', 'Repeat the password'), 'repeat', { type: 'password', auto: 'new-password', min: 8 })}${alerts()}<button class="button primary full" type="submit"${busy()}>${t('اعمل الحساب', 'Create the account')}</button></form>`
        : `<form data-acct-form="login" novalidate>${field(t('الإيميل', 'Email'), 'email', { type: 'email', auto: 'email', dir: 'ltr', max: 254 })}${field(t('كلمة السر', 'Password'), 'password', { type: 'password', auto: 'current-password' })}${alerts()}<button class="button primary full" type="submit"${busy()}>${t('ادخل', 'Sign in')}</button><button class="text-button" type="button" data-acct="tab" data-tab="forgot">${t('نسيت كلمة السر؟', 'Forgot your password?')}</button></form>`;
      return section(`${head}<div class="live-card">${tabs}${form}<p class="live-note">${t('الحساب بيحفظ طلباتك وبيعبّي اسمك ورقمك عند الطلب. بتقدر تطلب كضيف كمان.', 'An account keeps your orders and fills in your name and number at checkout. You can also order as a guest.')}</p>
        <button class="button full" type="button" data-acct="sample"${busy()}>${t('جرّب حساب العرض', 'Try the demo account')}</button>${demoNote()}</div>`);
    }
    const mine = app.getOrders().filter((o) => o && o.account && o.account.id === me.id);
    const list = mine.slice(0, ui.shown);
    const orders = list.length
      ? `<ul class="live-orders">${list.map((o) => `<li><div class="live-order-head"><strong dir="ltr">${esc(o.id)}</strong><span class="live-status s-${esc(o.status)}">${esc(statusName(o.status))}</span></div><p class="live-note">${esc(dateText(o.date))}</p><ul>${(o.items || []).map((i) => `<li><span dir="ltr">${esc(i.name)}</span> × ${esc(i.quantity)}${i.variant ? `<small dir="ltr">${esc(i.variant)}</small>` : ''}</li>`).join('')}</ul><p class="live-order-total">${t('المجموع', 'Total')}: <strong>${esc(app.money(o.total))}</strong></p></li>`).join('')}</ul>${mine.length > list.length ? `<button class="text-button" type="button" data-acct="older">${t('طلبات أقدم', 'Older orders')}</button>` : ''}`
      : `<p class="live-note">${t('لسا ما في طلبات على حسابك.', 'No orders on your account yet.')}</p>`;
    return section(`${head}${alerts()}<div class="live-grid">
      <div class="live-card"><h2>${t('بياناتي', 'My details')}</h2><p class="live-note" dir="ltr">${esc(me.email)}</p><form data-acct-form="profile" novalidate>${field(t('الاسم', 'Name'), 'name', { value: me.name, auto: 'name', min: 2, max: 80 })}${field(t('رقم الموبايل', 'Mobile'), 'phone', { type: 'tel', value: me.phone, auto: 'tel', dir: 'ltr', max: 20, required: false })}<button class="button primary full" type="submit"${busy()}>${t('احفظ', 'Save')}</button></form>
        <details class="live-details"><summary>${t('تغيير كلمة السر', 'Change password')}</summary><form data-acct-form="password" novalidate>${field(t('كلمة السر الحالية', 'Current password'), 'current', { type: 'password', auto: 'current-password' })}${field(t('كلمة السر الجديدة (8 خانات أو أكثر وفيها حرف)', 'New password (8+ characters, with a letter)'), 'password', { type: 'password', auto: 'new-password', min: 8 })}${field(t('أعد كلمة السر', 'Repeat the password'), 'repeat', { type: 'password', auto: 'new-password', min: 8 })}<button class="button primary full" type="submit"${busy()}>${t('غيّر كلمة السر', 'Change the password')}</button></form></details>
        <button class="text-button" type="button" data-acct="logout">${t('تسجيل خروج', 'Sign out')}</button>${demoNote()}</div>
      <div class="live-card"><h2>${t('طلباتي', 'My orders')}</h2>${orders}</div></div>`);
  }
  function resetPage() {
    const title = `<h1>${t('كلمة سر جديدة', 'New password')}</h1>`;
    if (!ui.token) return section(`<div class="live-card">${title}<p class="live-alert">${esc(message('reset-expired'))}</p><a class="text-button" href="#/account">${t('رجوع لتسجيل الدخول', 'Back to sign in')}</a></div>`);
    return section(`<div class="live-card">${title}<p class="live-note">${t('اختار كلمة سر 8 خانات أو أكثر وفيها حرف واحد على الأقل.', 'Choose a password of 8 characters or more, with at least one letter.')}</p>
      <form data-acct-form="reset" novalidate>${field(t('كلمة السر الجديدة', 'New password'), 'password', { type: 'password', auto: 'new-password', min: 8 })}${field(t('أعد كلمة السر', 'Repeat the password'), 'repeat', { type: 'password', auto: 'new-password', min: 8 })}${alerts()}<button class="button primary full" type="submit"${busy()}>${t('احفظ كلمة السر', 'Save the password')}</button></form></div>`);
  }

  // ---------- events ----------
  const actions = { register, login, profile: saveProfile, password: changePassword, forgot, reset };
  const okText = () => ({ register: t('انعمل حسابك.', 'Your account is ready.'), profile: t('انحفظت بياناتك.', 'Your details are saved.'), password: t('تغيّرت كلمة السر.', 'Your password is changed.'), reset: t('تغيّرت كلمة السر، وإنت داخل على حسابك.', 'Your password is changed and you are signed in.') });
  // A refused form keeps what was typed: the message appears inside it, without redrawing the page.
  function showError(form, text) {
    form.closest('.live-account')?.querySelectorAll('.live-success').forEach((el) => el.remove());
    let box = form.querySelector('.live-alert');
    if (!box) { form.querySelector('[type=submit]').insertAdjacentHTML('beforebegin', '<p class="live-alert" role="alert"></p>'); box = form.querySelector('.live-alert'); }
    box.textContent = text;
  }
  async function run(kind, work, form = null) {
    if (ui.busy) return;
    ui.busy = true; ui.error = ''; ui.ok = '';
    const submit = form && form.querySelector('[type=submit]'); if (submit) submit.disabled = true;
    try {
      await work();
      ui.ok = ui.ok || okText()[kind] || '';
      if (kind === 'reset') { history.replaceState(null, '', `${location.pathname}${location.search}#/account`); }
      if (['register', 'login', 'reset', 'sample'].includes(kind)) { ui.tab = 'signin'; ui.shown = PAGE; ui.link = ''; }
      ui.busy = false; app.render();
      if (['register', 'login', 'reset', 'sample', 'logout'].includes(kind)) window.scrollTo(0, 0);
    } catch (error) {
      ui.busy = false;
      if (error.code === 'signed-out') { ui.tab = 'signin'; app.render(); return; }
      if (form && form.isConnected) { if (submit) submit.disabled = false; showError(form, message(error.code)); return; }
      ui.error = message(error.code); app.render();
    }
  }
  document.addEventListener('submit', (event) => {
    const form = event.target.closest && event.target.closest('form[data-acct-form]');
    if (!form || !app) return;
    event.preventDefault();
    const kind = form.dataset.acctForm, data = Object.fromEntries(new FormData(form));
    run(kind, () => actions[kind](data), form);
  });
  document.addEventListener('click', (event) => {
    const button = event.target.closest && event.target.closest('[data-acct]');
    if (!button || !app) return;
    const what = button.dataset.acct;
    if (what === 'tab') { ui.tab = button.dataset.tab; ui.error = ''; ui.ok = ''; ui.link = ''; app.render(); }
    else if (what === 'older') { ui.shown += PAGE; app.render(); }
    else if (what === 'sample') run('sample', sample);
    else if (what === 'logout') run('logout', () => write((s) => { s.session = null; }));
    else if (what === 'wipe') { try { localStorage.removeItem(KEY); } catch {} ui.error = ''; app.render(); }
  });
  // Messages belong to the page they were shown on.
  window.addEventListener('hashchange', () => { ui.error = ''; ui.ok = ''; ui.link = ''; });
  // Another tab signed in, out or changed the account: show it here too.
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY || !app || !/^\/(account|reset\/)/.test(route())) return;
    if (!document.activeElement || !document.activeElement.closest || !document.activeElement.closest('form')) app.render();
  });

  // The account pages use the live site's account styles.
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'live.css?v=20261020-preview-accounts';
  document.head.append(css);

  // ---------- hooks used by app.js ----------
  window.OneStylePreviewAccounts = {
    attach: (api) => { app = api; },
    headerLink: () => {
      const label = current() ? t('حسابي', 'My account') : t('تسجيل الدخول', 'Sign in');
      return `<a class="icon-button live-account-link${route().startsWith('/account') ? ' active' : ''}" href="#/account" aria-label="${esc(label)}" title="${esc(label)}">${personIcon}</a>`;
    },
    menuLink: (arrow) => `<a href="#/account">${current() ? t('حسابي', 'My account') : t('تسجيل الدخول', 'Sign in')}${arrow}</a>`,
    route: (path) => {
      if (path === '/account') return accountPage();
      const reset = path.match(/^\/reset\/([0-9a-f]{64})?$/);
      if (reset) {
        // Keep the token in memory only, and take it out of the address bar.
        if (reset[1]) { ui.token = reset[1]; ui.error = ''; ui.ok = ''; history.replaceState(null, '', `${location.pathname}${location.search}#/reset/`); }
        return resetPage();
      }
      return null;
    },
    title: (path) => (path === '/account' ? (current() ? t('حسابي', 'My account') : t('تسجيل الدخول', 'Sign in')) : /^\/reset\//.test(path) ? t('كلمة سر جديدة', 'New password') : null),
    // Checkout: a signed-in shopper gets their name and number filled in, and the order joins My orders.
    decorateCheckout: (form) => {
      if (!form) return;
      const me = current();
      if (me) {
        form.elements.namedItem('name').value = me.name;
        if (me.phone) form.elements.namedItem('phone').value = me.phone;
      }
      form.insertAdjacentHTML('afterbegin', `<p class="modal-note">${me
        ? `${t('داخل باسم', 'Signed in as')} <bdi>${esc(me.name)}</bdi>. ${t('الطلب رح يظهر بـ «طلباتي».', 'The order will show in My orders.')}`
        : `<a href="#/account">${t('سجّل الدخول لحفظ الطلب في حسابك', 'Sign in to keep the order in your account')}</a> ${t('أو كمّل كضيف.', 'or continue as a guest.')}`}</p>`);
    },
    owner: () => { const me = current(); return me ? { id: me.id, email: me.email, name: me.name } : null; },
  };
})();
