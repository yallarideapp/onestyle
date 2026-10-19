// Orders: prices are always worked out here from the published catalog, with the same
// rules as the storefront (settings.js). The shopper's total must match to the fils.
import { HttpError, json, readJson, checkOrigin, takeSlots, ipKey, str, normaliseMobile, escHtml } from './util.js';
import { getContent, cfg } from './content.js';
import { customerId } from './customer.js';
import { sendMail } from './mail.js';

const TOKEN = /^[a-f0-9]{32}$/;
const STATUSES = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];
export const MAX_QTY = 20;      // per line, as in the bag
export const MAX_LINES = 20;    // each line is one database statement; a request may run 50
const fils = (jod) => Math.round(jod * 1000);
const CITY = { Amman: { ar: 'عمّان', en: 'Amman' }, Other: { ar: 'محافظة أخرى', en: 'Other governorate' } };
// Control and direction-override characters could forge lines in the order email or reorder
// a phone number on screen: they are removed. Address and notes keep their line breaks.
const HIDDEN_ALL = /[\u0000-\u0009\u000b-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
const textValue = (value, max) => str(typeof value === 'string' ? value.replace(/\r\n?/g, '\n').replace(HIDDEN_ALL, '') : value, max);
const oneLine = (value) => String(value || '').replace(/\s+/g, ' ').trim();

// Rebuilds every line from the catalog: device, finish, memory and storage must exist.
export function priceOrder(content, lines, fulfilment, city) {
  if (!Array.isArray(lines) || !lines.length) return { error: 'empty' };
  if (lines.length > MAX_LINES) return { error: 'too-many-lines' };
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    if (!line || typeof line !== 'object' || typeof line.productId !== 'string') return { error: 'bad-line' };
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QTY) return { error: 'bad-qty' };
    const product = content.catalog.find((p) => p.id === line.productId && !p.hidden);
    if (!product) return { error: 'unknown', id: line.productId };
    if (product.availability === 'unavailable') return { error: 'sold-out', id: product.id };
    if (!Number.isInteger(line.color) || line.color < 0 || line.color >= product.colors.length) return { error: 'unknown', id: product.id };
    const ram = product.ramOptions ? line.ram : null;
    const storage = product.storageOptions ? line.storage : null;
    if (product.ramOptions && !product.ramOptions.includes(ram)) return { error: 'unknown', id: product.id };
    if (product.storageOptions && !product.storageOptions.includes(storage)) return { error: 'unknown', id: product.id };
    if (!product.ramOptions && line.ram != null) return { error: 'unknown', id: product.id };
    if (!product.storageOptions && line.storage != null) return { error: 'unknown', id: product.id };
    const choice = { color: line.color, ram, storage };
    const key = `${product.id}|${line.color}|${ram}|${storage}`;
    if (seen.has(key)) return { error: 'duplicate' };
    seen.add(key);
    const unitFils = fils(cfg.unitPrice(product, choice));
    out.push({ product, choice, quantity: line.quantity, unitFils, variant: cfg.configurationText(product, choice) });
  }
  const subtotalFils = out.reduce((sum, l) => sum + l.unitFils * l.quantity, 0);
  const shippingFils = fils(cfg.deliveryFee(content.settings, fulfilment, city));
  return { lines: out, subtotalFils, shippingFils, totalFils: subtotalFils + shippingFils };
}

async function findByToken(env, token) {
  return env.DB.prepare('SELECT number, total_fils FROM orders WHERE token = ?').bind(token).first();
}

export async function placeOrder(request, env, ctx) {
  checkOrigin(request);
  const body = await readJson(request, 16 * 1024);
  const { content } = await getContent(env, { fresh: true });
  if (content.settings?.checkout?.ordersOn !== true) throw new HttpError(403, 'orders-off');
  if (str(body.website, 200)) throw new HttpError(400, 'bad-request'); // honeypot
  if (!(Number(body.elapsedMs) >= 3000)) throw new HttpError(400, 'too-fast');
  const token = String(body.token || '');
  if (!TOKEN.test(token)) throw new HttpError(400, 'bad-token');

  const existing = await findByToken(env, token);
  if (existing) return json({ number: existing.number, total: existing.total_fils / 1000 });

  if (!['pickup', 'delivery'].includes(body.fulfilment)) throw new HttpError(400, 'bad-fulfilment');
  const fulfilment = body.fulfilment;
  const c = body.customer && typeof body.customer === 'object' ? body.customer : {};
  const name = oneLine(textValue(c.name, 80));
  if (Array.from(name).length < 2 || /[<>]/.test(name)) throw new HttpError(400, 'bad-name');
  const phone = normaliseMobile(c.phone);
  if (!phone) throw new HttpError(400, 'bad-phone');
  let city = '';
  let address = '';
  if (fulfilment === 'delivery') {
    city = str(c.city, 10);
    if (!Object.hasOwn(CITY, city)) throw new HttpError(400, 'bad-city');
    address = textValue(c.address, 300);
    if (address.length < 4) throw new HttpError(400, 'bad-address');
  }
  const notes = textValue(c.notes, 300);
  const lang = body.lang === 'en' ? 'en' : 'ar';

  const priced = priceOrder(content, body.lines, fulfilment, city);
  if (priced.error) throw new HttpError(['unknown', 'sold-out'].includes(priced.error) ? 409 : 400, priced.error, priced.id ? { id: priced.id } : {});
  if (!Number.isSafeInteger(body.totalFils) || body.totalFils !== priced.totalFils) throw new HttpError(409, 'price-changed');

  const owner = await customerId(request, env);
  // Per shopper (IP) and for the whole shop, sized for a small shop and the free D1 write budget.
  await takeSlots(env, [[await ipKey(request, 'order'), 5, 3600], [await ipKey(request, 'order-day'), 20, 86400], ['order:*', 100, 3600], ['order-day:*', 1000, 86400]]);

  const createdAt = new Date().toISOString();
  const db = env.DB;
  const statements = [
    db.prepare("UPDATE counters SET value = value + 1 WHERE name = 'order'"),
    db.prepare("INSERT INTO orders (number, seq, token, created_at, status, name, phone, city, address, notes, fulfilment, lang, subtotal_fils, shipping_fils, total_fils, customer_id) SELECT 'OS-' || value, value, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM counters WHERE name = 'order'")
      .bind(token, createdAt, name, phone, city, address, notes, fulfilment, lang, priced.subtotalFils, priced.shippingFils, priced.totalFils, owner),
    ...priced.lines.map((line, position) => db.prepare("INSERT INTO order_lines (order_number, position, product_id, name, variant, qty, unit_fils) SELECT 'OS-' || value, ?, ?, ?, ?, ?, ? FROM counters WHERE name = 'order'")
      .bind(position, line.product.id, line.product.name, line.variant, line.quantity, line.unitFils)),
    db.prepare('SELECT number FROM orders WHERE token = ?').bind(token),
  ];
  let number;
  try {
    const results = await db.batch(statements);
    number = results[results.length - 1].results?.[0]?.number;
  } catch (error) {
    // A resend racing the first request hits the unique token: return the first order.
    const again = await findByToken(env, token);
    if (again) return json({ number: again.number, total: again.total_fils / 1000 });
    throw error;
  }
  if (!number) throw new HttpError(500, 'server');

  if (env.RESEND_API_KEY && env.ORDER_EMAIL) {
    ctx.waitUntil((async () => {
      try { await takeSlots(env, [['mail:order', 50, 86400]]); } catch { return; } // the rest of the daily email budget stays for resets
      await orderEmail(env, content, { number, createdAt, name, phone, city, address, notes, fulfilment, priced });
    })().catch((error) => console.error('order mail', error)));
  }
  return json({ number, total: priced.totalFils / 1000 }, 201);
}

const jod = (filsValue) => `${(filsValue / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 })} د.أ`;

function orderEmail(env, content, o) {
  const shop = content.settings?.brand?.name || 'One Style';
  const place = o.fulfilment === 'pickup' ? 'استلام من المحل' : `توصيل: ${CITY[o.city]?.ar || ''} — ${oneLine(o.address)}`;
  const rows = o.priced.lines.map((l) => `<tr><td style="padding:8px;border-bottom:1px solid #e3e3df">${escHtml(l.product.name)}<br><small style="color:#55595f">${escHtml(l.variant)}</small></td><td style="padding:8px;border-bottom:1px solid #e3e3df">× ${l.quantity}</td><td style="padding:8px;border-bottom:1px solid #e3e3df;white-space:nowrap">${escHtml(jod(l.unitFils * l.quantity))}</td></tr>`).join('');
  const html = `<div dir="rtl" style="background:#f4f4f1;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#16181d"><div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;padding:24px"><h1 style="font-size:20px;margin:0 0 6px">طلب جديد ${escHtml(o.number)}</h1><p style="margin:0 0 16px;color:#55595f">${escHtml(shop)} · ${escHtml(o.createdAt)}</p><p style="margin:0">${escHtml(o.name)} · <span dir="ltr">${escHtml(o.phone)}</span></p><p style="margin:4px 0 16px">${escHtml(place)}</p>${o.notes ? `<p style="margin:0 0 16px">ملاحظات: ${escHtml(o.notes)}</p>` : ''}<table style="border-collapse:collapse;width:100%">${rows}</table><p style="margin:14px 0 0">التوصيل: ${escHtml(jod(o.priced.shippingFils))}</p><p style="font-size:18px;margin:6px 0 0">المجموع: <strong style="color:#2469e8">${escHtml(jod(o.priced.totalFils))}</strong></p></div></div>`;
  const text = [`طلب جديد ${o.number}`, `${o.name} — ${o.phone}`, place, o.notes ? `ملاحظات: ${oneLine(o.notes)}` : '', ...o.priced.lines.map((l) => `- ${l.product.name} (${l.variant}) × ${l.quantity} = ${jod(l.unitFils * l.quantity)}`), `التوصيل: ${jod(o.priced.shippingFils)}`, `المجموع: ${jod(o.priced.totalFils)}`].filter(Boolean).join('\n');
  return sendMail(env, { to: env.ORDER_EMAIL, from: env.MAIL_FROM || 'One Style <onboarding@resend.dev>', subject: `طلب جديد ${o.number} — ${jod(o.priced.totalFils)}`, html, text, idempotencyKey: `order-${o.number}` });
}

// The admin's list, in the same shape as the browser preview's orders, so the admin pages
// show live orders without changes. Headers and lines are read in one snapshot.
export async function listOrders(env, url) {
  const status = url.searchParams.get('status') || '';
  if (status && !STATUSES.includes(status)) throw new HttpError(400, 'bad-status');
  const before = url.searchParams.get('before');
  if (before && (!/^\d{1,15}$/.test(before) || Number(before) < 1)) throw new HttpError(400, 'bad-cursor');
  const filters = []; const values = [];
  if (status) { filters.push('status = ?'); values.push(status); }
  if (before) { filters.push('seq < ?'); values.push(Number(before)); }
  const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
  const [heads, lineRows] = await env.DB.batch([
    env.DB.prepare(`SELECT * FROM orders${where} ORDER BY seq DESC LIMIT 300`).bind(...values),
    env.DB.prepare(`SELECT l.* FROM order_lines l JOIN (SELECT number FROM orders${where} ORDER BY seq DESC LIMIT 300) o ON o.number = l.order_number ORDER BY l.order_number, l.position`).bind(...values),
  ]);
  const orders = heads.results || [];
  const byOrder = new Map();
  for (const l of lineRows.results || []) {
    if (!byOrder.has(l.order_number)) byOrder.set(l.order_number, []);
    byOrder.get(l.order_number).push({ name: l.name, variant: l.variant, quantity: l.qty, unitPrice: l.unit_fils / 1000 });
  }
  return json({
    orders: orders.map((o) => ({
      id: o.number, date: o.created_at, status: o.status, note: o.note, fulfilment: o.fulfilment, lang: o.lang, account: o.customer_id ? 'account' : 'guest',
      customer: { name: o.name, phone: o.phone, city: o.fulfilment === 'pickup' ? '' : CITY[o.city]?.[o.lang] || o.city, address: o.fulfilment === 'pickup' ? (o.lang === 'en' ? 'Store collection' : 'استلام من المحل') : o.address, notes: o.notes },
      items: byOrder.get(o.number) || [], subtotal: o.subtotal_fils / 1000, shipping: o.shipping_fils / 1000, total: o.total_fils / 1000,
    })),
    nextBefore: orders.length === 300 ? orders[orders.length - 1].seq : null,
  });
}

export async function updateOrder(request, env, number) {
  const body = await readJson(request, 2048);
  const sets = []; const values = [];
  if (body.status !== undefined) { if (!STATUSES.includes(body.status)) throw new HttpError(400, 'bad-status'); sets.push('status = ?'); values.push(body.status); }
  if (body.note !== undefined) { if (typeof body.note !== 'string') throw new HttpError(400, 'bad-note'); sets.push('note = ?'); values.push(body.note.trim().slice(0, 500)); }
  if (!sets.length) throw new HttpError(400, 'nothing-to-change');
  const res = await env.DB.prepare(`UPDATE orders SET ${sets.join(', ')} WHERE number = ?`).bind(...values, number).run();
  if (!res.meta.changes) throw new HttpError(404, 'not-found');
  return json({ ok: true });
}
