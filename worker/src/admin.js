// The shop's single admin: first setup with SETUP_CODE, sign-in, password, sessions,
// publishing content, photo uploads and orders. Reset by email goes only to ADMIN_EMAIL.
import { HttpError, json, readJson, readBytes, checkOrigin, sha256, randomHex, safeEqual, takeSlots, clearSlots, ipKey, now, readCookie, TOKEN, ITERATIONS, adminPasswordProblem, passwordHash } from './util.js';
import { getContent, sanitizeContent, dropCache } from './content.js';
import { listOrders, updateOrder } from './orders.js';
import { resetReady } from './mail.js';
import { issueReset, findReset, clearResets, sendResetEmail } from './reset.js';

const SESSION_SECONDS = 12 * 3600;
const COOKIE = 'onestyle_admin';
const sessionCookie = (token, maxAge) => `${COOKIE}=${token}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;

const adminRow = (env) => env.DB.prepare('SELECT password_hash, salt, iterations, generation FROM admin WHERE id = 1').first();

async function session(request, env) {
  const token = readCookie(request, COOKIE);
  if (!TOKEN.test(token)) return false;
  const row = await env.DB.prepare('SELECT s.expires_at, s.generation, a.generation AS current FROM sessions s JOIN admin a ON a.id = 1 WHERE s.token_hash = ?').bind(await sha256(token)).first();
  return !!row && row.expires_at > now() && row.generation === row.current;
}

async function newSession(env, generation) {
  const token = randomHex(32);
  const t = now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(t),
    env.DB.prepare('INSERT INTO sessions (token_hash, generation, expires_at) VALUES (?, ?, ?)').bind(await sha256(token), generation, t + SESSION_SECONDS),
  ]);
  return token;
}

// Photos: PNG, JPEG or WebP up to 1.5 MB, checked by their first bytes, not by the name.
function photoType(bytes) {
  const at = (i, s) => s.split('').every((ch, k) => bytes[i + k] === ch.charCodeAt(0));
  if (bytes.length > 16 && at(0, 'RIFF') && at(8, 'WEBP')) return 'image/webp';
  if (bytes.length > 8 && bytes[0] === 0x89 && at(1, 'PNG')) return 'image/png';
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  return '';
}

export async function handleAdmin(request, env, ctx, url, path) {
  const method = request.method;
  if (method !== 'GET' && method !== 'HEAD') checkOrigin(request);

  if (path === 'status' && method === 'GET') {
    const row = await adminRow(env);
    return json({ setup: !!row, signedIn: row ? await session(request, env) : false, resetAvailable: resetReady(env) && Boolean(env.ADMIN_EMAIL) });
  }

  if (path === 'setup' && method === 'POST') {
    const body = await readJson(request, 2048);
    const setupCode = (env.SETUP_CODE || '').trim();
    if (setupCode.length < 24) throw new HttpError(503, 'not-configured');
    if (await adminRow(env)) throw new HttpError(409, 'already-setup');
    const key = await ipKey(request, 'setup');
    await takeSlots(env, [[key, 5, 900]]);
    if (typeof body.code !== 'string' || !safeEqual(body.code.trim(), setupCode)) throw new HttpError(403, 'bad-code');
    await clearSlots(env, key);
    if (adminPasswordProblem(body.password)) throw new HttpError(400, adminPasswordProblem(body.password));
    const salt = randomHex(16);
    const hash = await passwordHash(body.password, salt, ITERATIONS);
    const res = await env.DB.prepare('INSERT OR IGNORE INTO admin (id, password_hash, salt, iterations, generation, updated_at) VALUES (1, ?, ?, ?, 1, ?)').bind(hash, salt, ITERATIONS, new Date().toISOString()).run();
    if (!res.meta.changes) throw new HttpError(409, 'already-setup');
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(await newSession(env, 1), SESSION_SECONDS) });
  }

  // Five wrong tries per IP per 15 minutes. The slot is taken before any password work
  // and given back on success. No shop-wide lock, so other people's guesses can never
  // keep the owner out.
  if (path === 'login' && method === 'POST') {
    const body = await readJson(request, 2048);
    const row = await adminRow(env);
    if (!row) throw new HttpError(409, 'not-setup');
    const key = await ipKey(request, 'login');
    await takeSlots(env, [[key, 5, 900]]);
    const given = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
    if (!safeEqual(await passwordHash(given, row.salt, row.iterations), row.password_hash)) throw new HttpError(403, 'bad-password');
    await clearSlots(env, key);
    await clearResets(env, 'admin', 'admin').run();
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(await newSession(env, row.generation), SESSION_SECONDS) });
  }

  if (path === 'logout' && method === 'POST') {
    const token = readCookie(request, COOKIE);
    if (TOKEN.test(token)) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
  }

  // Forgotten password: the link goes only to ADMIN_EMAIL, set by the owner. The form
  // takes no address, so nobody can send it elsewhere.
  if (path === 'forgot' && method === 'POST') {
    await readJson(request, 1024);
    if (!resetReady(env) || !env.ADMIN_EMAIL) throw new HttpError(503, 'reset-off');
    await takeSlots(env, [[await ipKey(request, 'reset-ip'), 5, 3600], ['reset-admin', 3, 3600], ['reset-admin-day', 6, 86400]]);
    ctx.waitUntil((async () => {
      const row = await adminRow(env);
      if (!row) return;
      const token = await issueReset(env, 'admin', 'admin', row.generation);
      const { content } = await getContent(env);
      await sendResetEmail(env, { to: env.ADMIN_EMAIL, token, lang: 'ar', shopName: content.settings?.brand?.name, admin: true });
    })().catch((error) => console.error('admin reset mail', error)));
    return json({ ok: true });
  }

  if (path === 'reset' && method === 'POST') {
    const body = await readJson(request, 2048);
    await takeSlots(env, [[await ipKey(request, 'reset-try'), 10, 900]]);
    const token = typeof body.token === 'string' ? body.token : '';
    if (!TOKEN.test(token)) throw new HttpError(400, 'reset-expired');
    if (adminPasswordProblem(body.password)) throw new HttpError(400, adminPasswordProblem(body.password));
    const reset = await findReset(env, 'admin', token);
    const row = await adminRow(env);
    if (!reset || !row || row.generation !== reset.generation) throw new HttpError(400, 'reset-expired');
    const salt = randomHex(16);
    const hash = await passwordHash(body.password, salt, ITERATIONS);
    const results = await env.DB.batch([
      env.DB.prepare('UPDATE admin SET password_hash = ?, salt = ?, iterations = ?, generation = generation + 1, updated_at = ? WHERE id = 1 AND generation = ?').bind(hash, salt, ITERATIONS, new Date().toISOString(), reset.generation),
      env.DB.prepare('DELETE FROM sessions WHERE generation < (SELECT generation FROM admin WHERE id = 1)'),
      clearResets(env, 'admin', 'admin'),
    ]);
    if (!results[0].meta.changes) throw new HttpError(400, 'reset-expired');
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(await newSession(env, reset.generation + 1), SESSION_SECONDS) });
  }

  // Everything below needs a signed-in admin.
  if (!(await session(request, env))) throw new HttpError(401, 'signed-out');

  if (path === 'password' && method === 'POST') {
    const body = await readJson(request, 2048);
    const row = await adminRow(env);
    const key = await ipKey(request, 'login');
    await takeSlots(env, [[key, 5, 900]]);
    const current = await passwordHash(typeof body.current === 'string' ? body.current.slice(0, 200) : '', row.salt, row.iterations);
    if (!safeEqual(current, row.password_hash)) throw new HttpError(403, 'bad-password');
    await clearSlots(env, key);
    if (adminPasswordProblem(body.password)) throw new HttpError(400, adminPasswordProblem(body.password));
    const salt = randomHex(16);
    const hash = await passwordHash(body.password, salt, ITERATIONS);
    const generation = row.generation + 1;
    const results = await env.DB.batch([
      env.DB.prepare('UPDATE admin SET password_hash = ?, salt = ?, iterations = ?, generation = ?, updated_at = ? WHERE id = 1 AND generation = ?').bind(hash, salt, ITERATIONS, generation, new Date().toISOString(), row.generation),
      env.DB.prepare('DELETE FROM sessions WHERE generation < (SELECT generation FROM admin WHERE id = 1)'),
      clearResets(env, 'admin', 'admin'),
    ]);
    if (!results[0].meta.changes) throw new HttpError(409, 'conflict');
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(await newSession(env, generation), SESSION_SECONDS) });
  }

  if (path === 'content' && method === 'GET') {
    const { version, content } = await getContent(env, { fresh: true });
    return json({ version, content });
  }

  if (path === 'content' && method === 'PUT') {
    const body = await readJson(request, 900 * 1024);
    if (!Number.isInteger(body.baseVersion)) throw new HttpError(400, 'bad-version');
    const current = await getContent(env, { fresh: true });
    const clean = sanitizeContent(body.content, current.content.slugs);
    if (body.baseVersion !== current.version) throw new HttpError(409, 'conflict', { version: current.version });
    const version = current.version + 1;
    const text = JSON.stringify(clean);
    const stamp = new Date().toISOString();
    const statement = current.fromSeed
      ? env.DB.prepare('INSERT INTO content (id, version, body, updated_at) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO NOTHING').bind(version, text, stamp)
      : env.DB.prepare('UPDATE content SET version = ?, body = ?, updated_at = ? WHERE id = 1 AND version = ?').bind(version, text, stamp, current.version);
    const res = await statement.run();
    dropCache();
    if (!res.meta.changes) throw new HttpError(409, 'conflict');
    return json({ ok: true, version, content: clean });
  }

  if (path === 'photo' && method === 'POST') {
    const declared = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (!['image/webp', 'image/png', 'image/jpeg'].includes(declared)) throw new HttpError(415, 'bad-type');
    const bytes = await readBytes(request, 1536 * 1024);
    const type = photoType(bytes);
    if (!type || type !== declared) throw new HttpError(400, 'not-an-image');
    const id = randomHex(16);
    await env.PHOTOS.put(`photo:${id}`, bytes, { metadata: { type, at: Date.now() } });
    return json({ id, url: `api/photo/${id}` }, 201);
  }

  if (path === 'orders' && method === 'GET') return listOrders(env, url);
  const match = path.match(/^orders\/(OS-\d{1,9})$/);
  if (match && method === 'PATCH') return updateOrder(request, env, match[1]);

  throw new HttpError(404, 'not-found');
}
