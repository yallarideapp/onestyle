import { HttpError } from './util.js';
// Built from data.js and settings.js by tools/build.mjs, so the server checks content
// and prices with exactly the same rules as the storefront and the admin.
import { data, cfg } from './generated/shop-rules.js';

export { cfg };

// ---------- addresses (slugs) ----------
// Each device's address comes from its name and chip, e.g. "MacBook Pro 14″" + "M3" →
// /devices/macbook-pro-14-m3, stored with the name it came from ("base"). When a published
// device is renamed, its old address is kept and answers with a redirect to the new one.
export function slugify(text) {
  return String(text || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[″"'’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/, '');
}
export function assignSlugs(catalog, previous = {}) {
  const taken = new Set();
  const out = Object.create(null);
  const baseOf = (p) => slugify(`${p.name} ${p.chip || ''}`) || slugify(p.id) || 'device';
  const own = (id) => (Object.hasOwn(previous, id) ? previous[id] : undefined);
  // A device keeps the address it already has while its name still gives the same base, so
  // reordering two devices with the same name never swaps their addresses.
  const kept = new Map();
  for (const p of catalog) {
    const base = baseOf(p); const before = own(p.id);
    const slug = typeof before?.slug === 'string' ? before.slug : '';
    if (slug && (before.base === base || slug === base) && !taken.has(slug)) { kept.set(p.id, slug); taken.add(slug); }
  }
  for (const p of catalog) {
    const base = baseOf(p);
    let slug = kept.get(p.id);
    if (!slug) { slug = base; for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`; taken.add(slug); }
    const before = own(p.id);
    let old = Array.isArray(before?.old) ? before.old.filter((s) => typeof s === 'string') : [];
    // Only an address the public could have seen is worth redirecting.
    if (before && before.slug && before.slug !== slug && before.public) old = [before.slug, ...old];
    out[p.id] = { slug, base, old: [...new Set(old)].filter((s) => s !== slug).slice(0, 10), public: !p.hidden || !!before?.public };
  }
  // A current address always wins over someone else's old one.
  for (const entry of Object.values(out)) entry.old = entry.old.filter((s) => !taken.has(s));
  return out;
}

let cache = null;

// The published content: { settings, catalog, slugs }. Before the first publish, the shipped catalog.
export async function getContent(env, { fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cache.at < 5000) return cache.value;
  const row = await env.DB.prepare('SELECT version, body FROM content WHERE id = 1').first();
  let value;
  if (row) {
    value = { version: row.version, content: JSON.parse(row.body), fromSeed: false };
  } else {
    const settings = cfg.clone(cfg.defaults);
    const catalog = cfg.normalizeCatalog(data.products, settings);
    value = { version: 0, content: { settings, catalog, slugs: assignSlugs(catalog) }, fromSeed: true };
  }
  cache = { at: Date.now(), value };
  return value;
}
export function dropCache() { cache = null; }

// Shoppers never see hidden devices, the address history, or the admin's stock counts
// (the in-stock / out-of-stock status itself stays public).
export const publicCopy = (content) => {
  const catalog = content.catalog.filter((p) => !p.hidden).map(({ stockCount, ...p }) => p);
  return { settings: content.settings, catalog, slugs: Object.fromEntries(catalog.map((p) => [p.id, content.slugs?.[p.id]?.slug || slugify(p.id)])) };
};

// Every string in the content must be a link the site can serve: shipped assets, uploaded
// photos (api/photo/<id>) or https. Pasted pictures (data: URLs) are uploaded first by the admin.
function noInlineImages(value, path = '') {
  if (typeof value === 'string') { if (value.startsWith('data:')) throw new HttpError(400, 'inline-image', { field: path }); return; }
  if (Array.isArray(value)) { value.forEach((v, i) => noInlineImages(v, `${path}[${i}]`)); return; }
  if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) noInlineImages(v, path ? `${path}.${k}` : k);
}

// Rebuilds settings and catalog with the shared rules: unknown fields, bad links, bad
// colours or prices are refused, exactly as the admin refuses them.
export function sanitizeContent(input, previousSlugs = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'bad-content');
  let settings;
  let catalog;
  try { settings = cfg.normalizeSettings(input.settings, cfg.defaults); } catch (error) { throw new HttpError(400, 'bad-content', { field: 'settings', reason: String(error.message).slice(0, 80) }); }
  try { catalog = cfg.normalizeCatalog(input.catalog, settings); } catch (error) { throw new HttpError(400, 'bad-content', { field: 'catalog', reason: String(error.message).slice(0, 80) }); }
  noInlineImages({ settings, catalog });
  return { settings, catalog, slugs: assignSlugs(catalog, previousSlugs) };
}

// The site shows up on Google once the shop has published its content and turned ordering on.
export const indexable = (published) => !published.fromSeed && published.content.settings?.checkout?.ordersOn === true;
