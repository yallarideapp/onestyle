// Telegram settings are private: never part of content, exports, or a browser response.
import { HttpError, json, readJson, takeSlots, randomHex } from './util.js';
import { siteUrl } from './mail.js';

const TOKEN = /^\d{5,20}:[A-Za-z0-9_-]{20,120}$/;
const CHAT = /^-?[1-9]\d{0,15}$/;
const rowFor = (env) => env.DB.prepare('SELECT * FROM telegram_settings WHERE id = 1').first();
const metadata = (row) => ({ configured: !!row, enabled: !!row?.enabled, chatId: row?.chat_id || '', botUsername: row?.bot_username || '', version: row?.version || '', lastResult: row?.last_result || '', lastAttemptAt: row?.last_attempt_at || '' });
const oneLine = (text) => String(text || '').replace(/[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim();

function tokenFor(body, saved) {
  const token = body.token === undefined || body.token === '' ? saved?.token : typeof body.token === 'string' ? body.token.trim() : '';
  if (!TOKEN.test(token || '')) throw new HttpError(400, 'telegram-token');
  return token;
}

// Only local tests may replace Telegram. A request body can never choose an endpoint.
function endpoint(env, token, method) {
  if (env.TELEGRAM_TEST_URL) {
    try {
      const url = new URL(env.TELEGRAM_TEST_URL);
      if (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && !url.username && !url.password) return new URL(`/telegram/bot${token}/${method}`, url.origin).toString();
    } catch { /* use Telegram */ }
  }
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function call(env, token, method, body = {}) {
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new HttpError(502, 'telegram-unavailable')); }, 6000); });
  try {
    return await Promise.race([(async () => {
      const response = await fetch(endpoint(env, token, method), { method: 'POST', redirect: 'manual', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      let data;
      try { data = await response.json(); } catch { throw new HttpError(502, 'telegram-unavailable'); }
      if (!response.ok || data?.ok !== true) {
        const code = data?.error_code || response.status;
        throw new HttpError(502, ({ 401: 'telegram-token', 404: 'telegram-token', 403: 'telegram-blocked', 400: 'telegram-chat', 409: 'telegram-updates-busy', 429: 'telegram-rate-limited' })[code] || 'telegram-unavailable');
      }
      return data.result;
    })(), deadline]);
  } catch (error) {
    // Fetch errors may contain the URL (and token). Never return or log their text.
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, 'telegram-unavailable');
  } finally { clearTimeout(timer); }
}

async function record(env, row, result) {
  await env.DB.prepare('UPDATE telegram_settings SET last_result = ?, last_attempt_at = ? WHERE id = 1 AND version = ?').bind(result, new Date().toISOString(), row.version).run();
}

async function send(env, row, text) {
  try {
    await call(env, row.token, 'sendMessage', { chat_id: row.chat_id, text: text.slice(0, 3900), link_preview_options: { is_disabled: true } });
    await record(env, row, 'sent');
  } catch (error) {
    await record(env, row, error instanceof HttpError ? error.code : 'telegram-unavailable');
    throw error;
  }
}

// Called only after handleAdmin has verified the session and request origin.
export async function handleTelegram(request, env, path) {
  const method = request.method;
  if (path === 'telegram' && method === 'GET') return json(metadata(await rowFor(env)));
  const valid = (path === 'telegram' && ['PUT', 'DELETE'].includes(method)) || (['telegram/chats', 'telegram/test'].includes(path) && method === 'POST');
  if (!valid) throw new HttpError(404, 'not-found');
  const body = await readJson(request, 2048);
  const saved = await rowFor(env);
  if (path === 'telegram' && (typeof body.baseVersion !== 'string' || body.baseVersion !== (saved?.version || ''))) throw new HttpError(409, 'telegram-conflict');
  if (method === 'DELETE') {
    if (saved) {
      const result = await env.DB.prepare('DELETE FROM telegram_settings WHERE id = 1 AND version = ?').bind(saved.version).run();
      if (!result.meta.changes) throw new HttpError(409, 'telegram-conflict');
    }
    return json(metadata(null));
  }
  // Turning off alerts never depends on Telegram being reachable.
  if (method === 'PUT' && saved && body.enabled === false && !body.token && body.chatId === saved.chat_id) {
    const result = await env.DB.prepare('UPDATE telegram_settings SET enabled = 0, version = ?, updated_at = ? WHERE id = 1 AND version = ?').bind(randomHex(16), new Date().toISOString(), saved.version).run();
    if (!result.meta.changes) throw new HttpError(409, 'telegram-conflict');
    return json(metadata(await rowFor(env)));
  }
  await takeSlots(env, [['telegram:admin-minute', 40, 60], ['telegram:admin-day', 200, 86400]]);
  if (path === 'telegram/test') {
    if (!saved) throw new HttpError(400, 'telegram-not-configured');
    await send(env, saved, 'One Style — Telegram test\nتنبيهات الطلبات متصلة.\nOrder alerts are connected.');
    return json(metadata(await rowFor(env)));
  }
  const token = tokenFor(body, saved);
  if (path === 'telegram/chats') {
    // No offset or allowed_updates: discovering a chat must not consume updates or change the bot's subscriptions.
    const updates = await call(env, token, 'getUpdates', { limit: 100, timeout: 0 });
    const chats = new Map();
    for (const update of Array.isArray(updates) ? updates : []) {
      const chat = (update.message || update.channel_post || update.my_chat_member)?.chat;
      if (!chat || !Number.isSafeInteger(chat.id) || !CHAT.test(String(chat.id))) continue;
      chats.set(String(chat.id), { id: String(chat.id), label: oneLine(chat.title || chat.username || [chat.first_name, chat.last_name].filter(Boolean).join(' ')).slice(0, 80) || String(chat.id) });
    }
    return json({ chats: [...chats.values()].slice(0, 20) });
  }
  if (typeof body.enabled !== 'boolean' || typeof body.chatId !== 'string' || !CHAT.test(body.chatId.trim())) throw new HttpError(400, 'telegram-chat');
  const chatId = body.chatId.trim();
  const bot = await call(env, token, 'getMe');
  if (!bot?.is_bot || !/^[A-Za-z0-9_]{3,64}$/.test(bot.username || '')) throw new HttpError(502, 'telegram-token');
  await call(env, token, 'getChat', { chat_id: chatId });
  const at = new Date().toISOString();
  const version = randomHex(16);
  const result = saved
    ? await env.DB.prepare("UPDATE telegram_settings SET token = ?, chat_id = ?, bot_username = ?, enabled = ?, version = ?, updated_at = ?, last_result = '', last_attempt_at = '' WHERE id = 1 AND version = ?").bind(token, chatId, bot.username, body.enabled ? 1 : 0, version, at, saved.version).run()
    : await env.DB.prepare('INSERT OR IGNORE INTO telegram_settings (id, token, chat_id, bot_username, enabled, version, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?)').bind(token, chatId, bot.username, body.enabled ? 1 : 0, version, at).run();
  if (!result.meta.changes) throw new HttpError(409, 'telegram-conflict');
  return json(metadata(await rowFor(env)));
}

export async function sendOrderTelegram(env, content, order) {
  const saved = await rowFor(env);
  if (!saved?.enabled) return;
  const money = (n) => `${(n / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 })} JOD`;
  const lines = order.priced.lines.map((line) => `• ${oneLine(line.product.name)} (${oneLine(line.variant)}) × ${line.quantity} — ${money(line.unitFils * line.quantity)}`);
  const site = siteUrl(env);
  // Customer names, phone numbers and addresses stay in the authenticated admin panel.
  const heading = `${oneLine(content.settings?.brand?.name || 'One Style')} — طلب جديد / New order ${order.number}`;
  const footer = [`التوصيل / Delivery: ${money(order.priced.shippingFils)}`, `الإجمالي / Total: ${money(order.priced.totalFils)}`, site ? `${site}/#/admin/order/${order.number}` : ''].filter(Boolean).join('\n');
  const budget = Math.max(0, 3800 - heading.length - footer.length);
  const allItems = lines.join('\n');
  const items = allItems.length > budget ? `${allItems.slice(0, Math.max(0, budget - 65))}\n… التفاصيل الكاملة في اللوحة / Full details in admin` : allItems;
  const text = [heading, items, footer].join('\n');
  await send(env, saved, text);
}
