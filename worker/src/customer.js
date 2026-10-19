// Shopper accounts: sign-up, sign-in, profile, password, My orders and reset by email.
// Separate from the single shop admin (admin.js): different cookie, path and tables.
import { HttpError, json, readJson, checkOrigin, sha256, randomHex, safeEqual, takeSlots, ipKey, now, readCookie, TOKEN, normaliseMobile, ITERATIONS, strongEnough, passwordHash } from './util.js';
import { resetReady } from './mail.js';
import { issueReset, findReset, clearResets, sendResetEmail } from './reset.js';
import { getContent } from './content.js';

const SESSION_SECONDS = 7 * 86400;
const COOKIE = 'onestyle_customer';
const DUMMY_SALT = '5f1d3c9a0b7e4c2d8a6f1e3b9c0d7a24';

const sessionCookie = (token, maxAge) => `${COOKIE}=${token}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
const publicCustomer = (row) => ({ id: row.id, name: row.name, email: row.email, phone: row.phone });

function emailValue(value) {
  if (typeof value !== 'string') throw new HttpError(400, 'bad-email');
  const email = value.trim().toLowerCase();
  const local = email.slice(0, email.indexOf('@'));
  if (email.length > 254 || local.length > 64 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(email) || local.startsWith('.') || local.endsWith('.') || local.includes('..')) throw new HttpError(400, 'bad-email');
  return email;
}
function nameValue(value) {
  if (typeof value !== 'string') throw new HttpError(400, 'bad-name');
  const name = value.trim();
  const length = Array.from(name).length;
  if (length < 2 || length > 80 || /[\u0000-\u001f\u007f<>]/.test(name)) throw new HttpError(400, 'bad-name');
  return name;
}
function phoneValue(value) {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > 40) throw new HttpError(400, 'bad-phone');
  if (!value.trim()) return '';
  const phone = normaliseMobile(value);
  if (!phone) throw new HttpError(400, 'bad-phone');
  return phone;
}

// The "login" prefix makes the shared limiter answer with the translated "locked" code.
const slot = async (request, env, kind, max, windowSec) => takeSlots(env, [[await ipKey(request, `login:customer:${kind}`), max, windowSec]]);

async function session(request, env) {
  const token = readCookie(request, COOKIE);
  if (!TOKEN.test(token)) return null;
  return env.DB.prepare('SELECT c.id, c.name, c.email, c.phone, c.generation FROM customer_sessions s JOIN customers c ON c.id = s.customer_id WHERE s.token_hash = ? AND s.expires_at > ? AND s.generation = c.generation')
    .bind(await sha256(token), now()).first();
}

// Order ownership comes only from this verified session, never from the request body.
export async function customerId(request, env) {
  return (await session(request, env))?.id || null;
}

// New session, inserted only while the account still has the generation that was checked,
// so a sign-in that raced a password change can't open a session with the old password.
async function newSession(request, env, account) {
  const token = randomHex(32);
  const t = now();
  const previous = readCookie(request, COOKIE);
  const statements = [env.DB.prepare('DELETE FROM customer_sessions WHERE expires_at <= ?').bind(t), clearResets(env, 'customer', account.id)];
  if (TOKEN.test(previous)) statements.push(env.DB.prepare('DELETE FROM customer_sessions WHERE token_hash = ?').bind(await sha256(previous)));
  statements.push(env.DB.prepare('INSERT INTO customer_sessions (token_hash, customer_id, generation, expires_at) SELECT ?, id, generation, ? FROM customers WHERE id = ? AND generation = ?')
    .bind(await sha256(token), t + SESSION_SECONDS, account.id, account.generation));
  const results = await env.DB.batch(statements);
  if (!results[results.length - 1].meta.changes) throw new HttpError(403, 'bad-credentials');
  return token;
}

async function ownOrders(env, customer, url) {
  const cursor = url.searchParams.get('before');
  if (cursor !== null && (!/^[1-9]\d{0,15}$/.test(cursor) || !Number.isSafeInteger(Number(cursor)))) throw new HttpError(400, 'bad-cursor');
  const before = cursor === null ? Number.MAX_SAFE_INTEGER : Number(cursor);
  const [heads, lines] = await env.DB.batch([
    env.DB.prepare('SELECT number, seq, created_at, status, fulfilment, total_fils, shipping_fils FROM orders WHERE customer_id = ? AND seq < ? ORDER BY seq DESC LIMIT 51').bind(customer.id, before),
    env.DB.prepare('SELECT l.* FROM order_lines l JOIN (SELECT number FROM orders WHERE customer_id = ? AND seq < ? ORDER BY seq DESC LIMIT 50) o ON o.number = l.order_number ORDER BY l.order_number, l.position').bind(customer.id, before),
  ]);
  const rows = heads.results || [];
  const byOrder = new Map();
  for (const l of lines.results || []) {
    if (!byOrder.has(l.order_number)) byOrder.set(l.order_number, []);
    byOrder.get(l.order_number).push({ name: l.name, variant: l.variant, quantity: l.qty, unitPrice: l.unit_fils / 1000 });
  }
  const page = rows.slice(0, 50);
  return json({
    orders: page.map((o) => ({ id: o.number, date: o.created_at, status: o.status, fulfilment: o.fulfilment, shipping: o.shipping_fils / 1000, total: o.total_fils / 1000, items: byOrder.get(o.number) || [] })),
    nextBefore: rows.length > 50 ? page[page.length - 1].seq : null,
  });
}

export async function handleCustomer(request, env, ctx, url, path) {
  const method = request.method;
  if (method !== 'GET' && method !== 'HEAD') checkOrigin(request);

  if (path === 'session' && method === 'GET') {
    const customer = await session(request, env);
    return json({ signedIn: !!customer, customer: customer ? publicCustomer(customer) : null, resetAvailable: resetReady(env) });
  }

  if (path === 'register' && method === 'POST') {
    const body = await readJson(request, 4096);
    // Sign-up answers "email in use" for an existing address; tight limits keep that lookup slow.
    await slot(request, env, 'register', 5, 3600);
    await slot(request, env, 'register-day', 20, 86400);
    const name = nameValue(body.name);
    const email = emailValue(body.email);
    if (!strongEnough(body.password)) throw new HttpError(400, 'weak-password');
    const phone = phoneValue(body.phone);
    const salt = randomHex(16);
    const hash = await passwordHash(body.password, salt, ITERATIONS);
    const customer = { id: randomHex(16), name, email, phone };
    const token = randomHex(32);
    const stamp = new Date().toISOString();
    const results = await env.DB.batch([
      env.DB.prepare('INSERT INTO customers (id, email, name, phone, password_hash, salt, iterations, generation, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?) ON CONFLICT(email) DO NOTHING')
        .bind(customer.id, email, name, phone, hash, salt, ITERATIONS, stamp, stamp),
      env.DB.prepare('INSERT INTO customer_sessions (token_hash, customer_id, generation, expires_at) SELECT ?, id, generation, ? FROM customers WHERE id = ?').bind(await sha256(token), now() + SESSION_SECONDS, customer.id),
    ]);
    if (!results[0].meta.changes) throw new HttpError(409, 'email-in-use');
    return json({ ok: true, customer }, 201, { 'Set-Cookie': sessionCookie(token, SESSION_SECONDS) });
  }

  if (path === 'login' && method === 'POST') {
    const body = await readJson(request, 4096);
    await slot(request, env, 'login', 10, 900);
    let email = '';
    try { email = emailValue(body.email); } catch { /* Same answer and the same hashing for a malformed email. */ }
    const account = email ? await env.DB.prepare('SELECT id, name, email, phone, password_hash, salt, iterations, generation FROM customers WHERE email = ?').bind(email).first() : null;
    const valid = typeof body.password === 'string' && body.password.length <= 200;
    const hash = await passwordHash(valid ? body.password : '', account?.salt || DUMMY_SALT, account?.iterations || ITERATIONS);
    if (!account || !valid || !safeEqual(hash, account.password_hash)) throw new HttpError(403, 'bad-credentials');
    const token = await newSession(request, env, account);
    return json({ ok: true, customer: publicCustomer(account) }, 200, { 'Set-Cookie': sessionCookie(token, SESSION_SECONDS) });
  }

  if (path === 'logout' && method === 'POST') {
    await readJson(request, 1024);
    const token = readCookie(request, COOKIE);
    if (TOKEN.test(token)) await env.DB.prepare('DELETE FROM customer_sessions WHERE token_hash = ?').bind(await sha256(token)).run();
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
  }

  if (path === 'forgot' && method === 'POST') {
    const body = await readJson(request, 2048);
    if (!resetReady(env)) throw new HttpError(503, 'reset-off');
    await takeSlots(env, [[await ipKey(request, 'reset-ip'), 5, 3600]]);
    const email = emailValue(body.email);
    const lang = body.lang === 'en' ? 'en' : 'ar';
    // Same answer and the same timing whether or not the email has an account: the work
    // happens after the response.
    ctx.waitUntil((async () => {
      const account = await env.DB.prepare('SELECT id, generation FROM customers WHERE email = ?').bind(email).first();
      if (!account) return;
      // Daily email budget (Resend free: 100 a day): shopper resets 30, admin resets 6, order alerts 50.
      try { await takeSlots(env, [[`reset-account:${account.id}`, 3, 3600], ['reset-all', 30, 86400]]); } catch { return; }
      const token = await issueReset(env, 'customer', account.id, account.generation);
      const { content } = await getContent(env);
      await sendResetEmail(env, { to: email, token, lang, shopName: content.settings?.brand?.name, admin: false });
    })().catch((error) => console.error('reset mail', error)));
    return json({ ok: true });
  }

  if (path === 'reset' && method === 'POST') {
    const body = await readJson(request, 2048);
    await takeSlots(env, [[await ipKey(request, 'reset-try'), 10, 900]]);
    const token = typeof body.token === 'string' ? body.token : '';
    if (!TOKEN.test(token)) throw new HttpError(400, 'reset-expired');
    if (!strongEnough(body.password)) throw new HttpError(400, 'weak-password');
    const row = await findReset(env, 'customer', token);
    if (!row) throw new HttpError(400, 'reset-expired');
    const account = await env.DB.prepare('SELECT id, name, email, phone, generation FROM customers WHERE id = ?').bind(row.account_id).first();
    if (!account || account.generation !== row.generation) throw new HttpError(400, 'reset-expired');
    const salt = randomHex(16);
    const hash = await passwordHash(body.password, salt, ITERATIONS);
    const sessionToken = randomHex(32);
    const results = await env.DB.batch([
      env.DB.prepare('UPDATE customers SET password_hash = ?, salt = ?, iterations = ?, generation = generation + 1, updated_at = ? WHERE id = ? AND generation = ?').bind(hash, salt, ITERATIONS, new Date().toISOString(), account.id, row.generation),
      env.DB.prepare('DELETE FROM customer_sessions WHERE customer_id = ? AND generation < (SELECT generation FROM customers WHERE id = ?)').bind(account.id, account.id),
      clearResets(env, 'customer', account.id),
      env.DB.prepare('INSERT INTO customer_sessions (token_hash, customer_id, generation, expires_at) SELECT ?, id, generation, ? FROM customers WHERE id = ? AND generation = ? AND password_hash = ?')
        .bind(await sha256(sessionToken), now() + SESSION_SECONDS, account.id, row.generation + 1, hash),
    ]);
    if (!results[0].meta.changes || !results[3].meta.changes) throw new HttpError(400, 'reset-expired');
    return json({ ok: true, customer: publicCustomer(account) }, 200, { 'Set-Cookie': sessionCookie(sessionToken, SESSION_SECONDS) });
  }

  const customer = await session(request, env);
  if (!customer) throw new HttpError(401, 'signed-out');
  if (path === 'profile' && method === 'GET') return json({ customer: publicCustomer(customer) });
  if (path === 'orders' && method === 'GET') return ownOrders(env, customer, url);

  if (path === 'profile' && method === 'PATCH') {
    const body = await readJson(request, 2048);
    await slot(request, env, 'profile', 30, 900);
    if (body.name === undefined && body.phone === undefined) throw new HttpError(400, 'nothing-to-change');
    const name = body.name === undefined ? customer.name : nameValue(body.name);
    const phone = body.phone === undefined ? customer.phone : phoneValue(body.phone);
    await env.DB.prepare('UPDATE customers SET name = ?, phone = ?, updated_at = ? WHERE id = ?').bind(name, phone, new Date().toISOString(), customer.id).run();
    return json({ customer: { ...publicCustomer(customer), name, phone } });
  }

  if (path === 'password' && method === 'POST') {
    const body = await readJson(request, 4096);
    await slot(request, env, 'password', 5, 900);
    if (!strongEnough(body.password)) throw new HttpError(400, 'weak-password');
    const account = await env.DB.prepare('SELECT id, password_hash, salt, iterations, generation FROM customers WHERE id = ?').bind(customer.id).first();
    if (!account) throw new HttpError(401, 'signed-out');
    const validCurrent = typeof body.current === 'string' && body.current.length <= 200;
    const current = await passwordHash(validCurrent ? body.current : '', account.salt, account.iterations);
    if (!validCurrent || !safeEqual(current, account.password_hash)) throw new HttpError(403, 'bad-credentials');
    const salt = randomHex(16);
    const hash = await passwordHash(body.password, salt, ITERATIONS);
    const token = randomHex(32);
    const generation = account.generation + 1;
    const results = await env.DB.batch([
      env.DB.prepare('UPDATE customers SET password_hash = ?, salt = ?, iterations = ?, generation = ?, updated_at = ? WHERE id = ? AND generation = ? AND password_hash = ?')
        .bind(hash, salt, ITERATIONS, generation, new Date().toISOString(), customer.id, account.generation, account.password_hash),
      env.DB.prepare('DELETE FROM customer_sessions WHERE customer_id = ? AND generation < (SELECT generation FROM customers WHERE id = ?)').bind(customer.id, customer.id),
      clearResets(env, 'customer', customer.id),
      env.DB.prepare('INSERT INTO customer_sessions (token_hash, customer_id, generation, expires_at) SELECT ?, id, generation, ? FROM customers WHERE id = ? AND generation = ? AND password_hash = ?')
        .bind(await sha256(token), now() + SESSION_SECONDS, customer.id, generation, hash),
    ]);
    if (!results[0].meta.changes || !results[3].meta.changes) throw new HttpError(403, 'bad-credentials');
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(token, SESSION_SECONDS) });
  }

  throw new HttpError(404, 'not-found');
}
