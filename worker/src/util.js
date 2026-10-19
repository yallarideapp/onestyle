// Small helpers shared by every API route.

export class HttpError extends Error {
  constructor(status, code, extra = {}) { super(code); this.status = status; this.code = code; this.extra = extra; }
}

const baseHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
};

export function json(data, status = 200, headers = {}) {
  // Escape <, > and & so a value can never be read as markup.
  const body = JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  return new Response(body, { status, headers: { ...baseHeaders, ...headers } });
}

export function fail(error) {
  if (error instanceof HttpError) return json({ error: error.code, ...error.extra }, error.status);
  console.error('unhandled', error instanceof Error ? error.stack || error.message : error);
  return json({ error: 'server' }, 500);
}

// Same-site requests only for anything that changes data.
export function checkOrigin(request) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (origin) {
    if (origin !== url.origin) throw new HttpError(403, 'bad-origin');
    return;
  }
  if (request.headers.get('Sec-Fetch-Site') !== 'same-origin') throw new HttpError(403, 'bad-origin');
}

// Reads the body as a stream and stops as soon as it passes the cap, so a request
// without Content-Length can't make the Worker buffer a huge body.
async function readCapped(request, maxBytes) {
  const declared = Number(request.headers.get('Content-Length') || '0');
  if (declared > maxBytes) throw new HttpError(413, 'too-large');
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { reader.releaseLock(); throw new HttpError(413, 'too-large'); }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.byteLength; }
  return out;
}

export async function readJson(request, maxBytes) {
  const type = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') throw new HttpError(415, 'bad-type');
  const bytes = await readCapped(request, maxBytes);
  let value;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new HttpError(400, 'bad-json'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'bad-json');
  return value;
}

export const readBytes = (request, maxBytes) => readCapped(request, maxBytes);

const encoder = new TextEncoder();
export const hex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
export async function sha256(text) { return hex(await crypto.subtle.digest('SHA-256', encoder.encode(text))); }
export function randomHex(bytes) { const a = new Uint8Array(bytes); crypto.getRandomValues(a); return hex(a); }

export function safeEqual(a, b) {
  const x = encoder.encode(a); const y = encoder.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

// PBKDF2-SHA-256. 20,000 rounds keep a sign-in (and a password change, which hashes
// twice) inside the free plan's 10 ms of CPU; the 16-character minimum makes up for it.
// Each stored row keeps its own round count, so older hashes still verify.
export const ITERATIONS = 20000;
export const strongEnough = (value) => typeof value === 'string' && value.length >= 16 && value.length <= 200;
export async function passwordHash(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltHex.match(/../g).map((pair) => parseInt(pair, 16)));
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}

export function clientIp(request) {
  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  if (!ip.includes(':')) return ip;
  // Group IPv6 addresses by their /56 (a home or phone line) so one line can't rotate around limits.
  const [head, tail = ''] = ip.split('::');
  const a = head ? head.split(':') : [];
  const b = tail ? tail.split(':') : [];
  const groups = ip.includes('::') ? [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b] : a;
  const g = groups.map((x) => parseInt(x, 16) || 0);
  return `${g.slice(0, 3).map((x) => x.toString(16)).join(':')}:${((g[3] || 0) & 0xff00).toString(16)}::/56`;
}

export const now = () => Math.floor(Date.now() / 1000);

// Takes one slot for each key, atomically: the row is only added while the key is
// under its limit, so requests sent in parallel can't all slip through.
export async function takeSlots(env, checks) {
  const t = now();
  for (const [key, max, windowSec] of checks) {
    const res = await env.DB.prepare('INSERT INTO attempts (key, at) SELECT ?1, ?2 WHERE (SELECT COUNT(*) FROM attempts WHERE key = ?1 AND at > ?3) < ?4').bind(key, t, t - windowSec, max).run();
    if (!res.meta.changes) throw new HttpError(429, key.startsWith('login') || key.startsWith('setup') ? 'locked' : 'rate-limited');
  }
  if (Math.random() < 0.02) await env.DB.prepare('DELETE FROM attempts WHERE at < ?').bind(t - 86400).run();
}

export async function clearSlots(env, key) {
  await env.DB.prepare('DELETE FROM attempts WHERE key = ?').bind(key).run();
}

export const ipKey = async (request, kind) => `${kind}:${await sha256(`onestyle-${kind}:${clientIp(request)}`)}`;

export const str = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

// Jordanian mobile numbers: Arabic or Persian digits, +962, 00962 and 962 all become 07XXXXXXXX.
export function normaliseMobile(value) {
  const digits = String(value || '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[^\d+]/g, '');
  let local = digits;
  if (local.startsWith('+962')) local = '0' + local.slice(4);
  else if (local.startsWith('00962')) local = '0' + local.slice(5);
  else if (local.startsWith('962')) local = '0' + local.slice(3);
  if (local.startsWith('00')) local = local.slice(1);
  if (/^7\d{8}$/.test(local)) local = '0' + local;
  return /^07[789]\d{7}$/.test(local) ? local : null;
}

// Session cookies: the token travels in the cookie, only its hash is stored.
export function readCookie(request, name) {
  for (const part of (request.headers.get('Cookie') || '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return '';
}
export const TOKEN = /^[a-f0-9]{64}$/;
export const escHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
