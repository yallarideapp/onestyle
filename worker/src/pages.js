// Real addresses for Google: every device and category gets its own page, in English
// (/devices/<slug>) and Arabic (/ar/devices/<slug>). The page is the site's own index.html
// with that page's title, description, links and product data written in, so it reads
// without script; the storefront then takes over in the browser.
import { escHtml as esc } from './util.js';
import { getContent, cfg, indexable } from './content.js';
import { siteUrl } from './mail.js';

const PAGES = new Set(['shop', 'guide', 'service', 'compare', 'account', 'admin']);
export const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Frame-Options': 'DENY',
};

// "/ar/devices/x" → { lang: 'ar', parts: ['devices', 'x'] }
export function parsePath(pathname) {
  let rest = pathname;
  let lang = 'en';
  if (rest === '/ar' || rest.startsWith('/ar/')) { lang = 'ar'; rest = rest.slice(3); }
  const parts = rest.split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
  return { lang, parts };
}
const prefix = (lang) => (lang === 'ar' ? '/ar' : '');
const pathFor = (lang, rest) => `${prefix(lang)}${rest}` || '/';

export function isPagePath(pathname) {
  if (pathname === '/robots.txt' || pathname === '/sitemap.xml') return true;
  const { parts } = parsePath(pathname);
  if (!parts.length) return true;
  if (parts[0] === 'devices') return parts.length === 2;
  if (PAGES.has(parts[0])) return true;
  return parts.length === 1 && /^[a-z0-9-]{1,60}$/.test(parts[0]);
}

const priceText = (n) => `${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })} JOD`;
const availability = (a) => ({ available: 'InStock', 'on-order': 'PreOrder', unavailable: 'OutOfStock' }[a] || 'LimitedAvailability');
const textOf = (group, key, lang) => (group && group[key + (lang === 'ar' ? 'Ar' : 'En')]) || '';

function imageFor(settings, product, origin) {
  const list = cfg.categoryList(settings);
  const src = product.image || list.find((c) => c.art === product.art)?.image || settings.media?.[product.art] || cfg.defaults.media[product.art] || '';
  if (!src || src.startsWith('data:')) return '';
  try { return new URL(src, `${origin}/`).toString(); } catch { return ''; }
}

// Works out what an address shows; null means "not a page we know".
function resolve(published, lang, parts) {
  const { settings, catalog, slugs = {} } = published.content;
  const visible = catalog.filter((p) => !p.hidden);
  if (!parts.length) return { kind: 'home', route: '/' };
  const [first, second] = parts;
  if (first === 'devices') {
    const byCurrent = Object.entries(slugs).find(([, s]) => s.slug === second);
    const product = byCurrent && visible.find((p) => p.id === byCurrent[0]);
    if (product) return { kind: 'device', route: `/devices/${second}`, product };
    const moved = Object.entries(slugs).find(([id, s]) => s.old?.includes(second) && visible.some((p) => p.id === id));
    if (moved) return { kind: 'moved', location: pathFor(lang, `/devices/${moved[1].slug}`) };
    return null;
  }
  if (PAGES.has(first)) return parts.length === 1 || first === 'admin' ? { kind: first, route: `/${first}` } : null;
  if (parts.length !== 1) return null;
  if (first === 'used-like-new') return { kind: 'category', route: '/used-like-new', category: { id: first, labelAr: 'مستعمل كالجديد', labelEn: 'Used — like new' }, products: visible.filter((p) => p.condition === 'used-like-new') };
  const category = cfg.categoryList(settings).find((c) => c.id === first);
  if (!category) return null;
  return { kind: 'category', route: `/${first}`, category, products: visible.filter((p) => p.category === first) };
}

function deviceLink(lang, slugs, p) { return pathFor(lang, `/devices/${slugs[p.id]?.slug || p.id}`); }

function pageBody(page, published, lang) {
  const { settings, catalog, slugs = {} } = published.content;
  const brand = settings.brand?.name || 'One Style';
  const ar = lang === 'ar';
  const list = (items) => `<ul>${items.map((p) => `<li><a href="${esc(deviceLink(lang, slugs, p))}">${esc(p.name)}${p.chip ? ` · ${esc(p.chip)}` : ''}</a> — ${esc(priceText(cfg.startPrice(p)))}</li>`).join('')}</ul>`;
  const visible = catalog.filter((p) => !p.hidden);
  if (page.kind === 'device') {
    const p = page.product;
    const specs = [p.chip, p.cpu, p.ram, p.storage, p.screen, p.network].filter(Boolean);
    return `<main class="seo-page"><p><a href="${esc(pathFor(lang, '/'))}">${esc(brand)}</a></p><h1>${esc(p.name)}${p.chip ? ` · ${esc(p.chip)}` : ''}</h1><p>${esc(ar ? p.descriptionAr : p.descriptionEn)}</p><ul>${specs.map((s) => `<li>${esc(s)}</li>`).join('')}</ul><p>${esc(priceText(cfg.startPrice(p)))}</p></main>`;
  }
  if (page.kind === 'category') return `<main class="seo-page"><h1>${esc(ar ? page.category.labelAr : page.category.labelEn)} — ${esc(brand)}</h1>${list(page.products)}</main>`;
  if (page.kind === 'shop') return `<main class="seo-page"><h1>${esc(textOf(settings.pageTitles, 'shop', lang) || brand)}</h1>${list(visible)}</main>`;
  if (page.kind === 'home') {
    const cats = cfg.categoryList(settings).filter((c) => visible.some((p) => p.category === c.id));
    return `<main class="seo-page"><h1>${esc(brand)} — ${esc(textOf(settings.hero, 'title', lang))}</h1><p>${esc(textOf(settings.hero, 'description', lang))}</p><ul>${cats.map((c) => `<li><a href="${esc(pathFor(lang, `/${c.id}`))}">${esc(ar ? c.labelAr : c.labelEn)}</a></li>`).join('')}</ul>${list(visible.slice(0, 12))}</main>`;
  }
  return '<main class="seo-page"></main>';
}

function pageHead(page, published, lang, origin, rest, robots) {
  const { settings, slugs = {} } = published.content;
  const brand = settings.brand?.name || 'One Style';
  const ar = lang === 'ar';
  let title = `${brand} — ${textOf(settings.pageTitles, 'home', lang)}`;
  let description = textOf(settings.hero, 'description', lang) || textOf(settings.brand, 'tagline', lang);
  let image = `${origin}/assets/photos/macbook-studio.webp`;
  let jsonld = { '@context': 'https://schema.org', '@type': 'Store', name: brand, url: `${origin}/`, telephone: settings.brand?.internationalPhone || undefined, address: textOf(settings.brand, 'address', lang) || undefined };
  if (page.kind === 'device') {
    const p = page.product;
    const name = `${p.name}${p.chip ? ` ${p.chip}` : ''}`;
    title = `${name} — ${brand}`;
    description = (ar ? p.descriptionAr : p.descriptionEn) || [p.chip, p.ram, p.storage, p.screen].filter(Boolean).join(' · ');
    description = `${description} ${ar ? 'السعر' : 'Price'}: ${priceText(cfg.startPrice(p))}.`.trim();
    image = imageFor(settings, p, origin) || image;
    jsonld = { '@context': 'https://schema.org', '@type': 'Product', name, sku: p.id, description, image: image || undefined,
      offers: { '@type': 'Offer', url: `${origin}${pathFor(lang, `/devices/${slugs[p.id]?.slug || p.id}`)}`, priceCurrency: 'JOD', price: Number(cfg.startPrice(p)).toFixed(2), availability: `https://schema.org/${availability(p.availability)}`, itemCondition: `https://schema.org/${p.condition === 'used-like-new' ? 'UsedCondition' : 'NewCondition'}`, seller: { '@type': 'Organization', name: brand } } };
  } else if (page.kind === 'category') {
    title = `${ar ? page.category.labelAr : page.category.labelEn} — ${brand}`;
    description = page.products.map((p) => p.name).slice(0, 8).join(' · ') || description;
  } else if (page.kind === 'shop') {
    title = `${textOf(settings.pageTitles, 'shop', lang)} — ${brand}`;
  } else if (['guide', 'service', 'compare', 'account', 'admin'].includes(page.kind)) {
    title = `${brand} — ${textOf(settings.pageTitles, page.kind, lang) || ({ guide: ar ? 'اختَر جهازك' : 'Find your Mac', service: ar ? 'الصيانة والدعم' : 'Service & support', compare: ar ? 'قارن' : 'Compare', account: ar ? 'حسابي' : 'My account', admin: ar ? 'لوحة الإدارة' : 'Admin' }[page.kind])}`;
  }
  const en = `${origin}${rest}`;
  const arUrl = `${origin}/ar${rest === '/' ? '' : rest}`;
  const canonical = ar ? arUrl : en;
  const json = JSON.stringify(jsonld).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  return `<title>${esc(title)}</title>
  <meta name="description" content="${esc(String(description).slice(0, 300))}">
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${esc(canonical)}">
  <link rel="alternate" hreflang="en" href="${esc(en)}">
  <link rel="alternate" hreflang="ar" href="${esc(arUrl)}">
  <link rel="alternate" hreflang="x-default" href="${esc(en)}">
  <meta property="og:type" content="${page.kind === 'device' ? 'product' : 'website'}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(String(description).slice(0, 300))}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:site_name" content="${esc(brand)}">
  <meta property="og:locale" content="${ar ? 'ar_JO' : 'en_JO'}">
  ${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
  <script type="application/ld+json">${json}</script>`;
}

const html = (body, status, extra = {}) => new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', ...SECURITY_HEADERS, ...extra } });
const text = (body, type, status = 200) => new Response(body, { status, headers: { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' } });

export async function renderPage(request, env, url) {
  const published = await getContent(env);
  const origin = siteUrl(env) || url.origin;
  const open = indexable(published);

  if (url.pathname === '/robots.txt') {
    return text(open ? `User-agent: *\nDisallow: /admin\nDisallow: /ar/admin\nDisallow: /account\nDisallow: /ar/account\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n', 'text/plain');
  }
  if (url.pathname === '/sitemap.xml') {
    if (!open) return text('Not found', 'text/plain', 404);
    const { settings, catalog, slugs = {} } = published.content;
    const visible = catalog.filter((p) => !p.hidden);
    const rests = ['/', '/shop', ...cfg.categoryList(settings).filter((c) => visible.some((p) => p.category === c.id)).map((c) => `/${c.id}`), ...visible.map((p) => `/devices/${slugs[p.id]?.slug || p.id}`)];
    const entry = (rest) => { const en = `${origin}${rest}`; const ar = `${origin}/ar${rest === '/' ? '' : rest}`; const alt = `<xhtml:link rel="alternate" hreflang="en" href="${esc(en)}"/><xhtml:link rel="alternate" hreflang="ar" href="${esc(ar)}"/>`; return `<url><loc>${esc(en)}</loc>${alt}</url><url><loc>${esc(ar)}</loc>${alt}</url>`; };
    return text(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${rests.map(entry).join('')}</urlset>\n`, 'application/xml');
  }

  const { lang, parts } = parsePath(url.pathname);
  // One address per page: no trailing slash (the home page is "/" and "/ar").
  const clean = pathFor(lang, parts.length ? `/${parts.map(encodeURIComponent).join('/')}` : '');
  if (url.pathname !== clean) return Response.redirect(`${url.origin}${clean}${url.search}`, 301);

  const page = resolve(published, lang, parts);
  // A day of browser caching, not forever: a device renamed back to an older name must not loop.
  if (page && page.kind === 'moved') return new Response(null, { status: 301, headers: { Location: `${url.origin}${page.location}`, 'Cache-Control': 'public, max-age=86400' } });

  const shell = await env.ASSETS.fetch(new Request(new URL('/', url), { headers: { Accept: 'text/html' } }));
  let doc = await shell.text();
  const rest = page ? page.route : `/${parts.join('/')}`;
  const privatePage = page && ['account', 'admin'].includes(page.kind);
  const robots = page && open && !privatePage ? 'index,follow' : 'noindex,nofollow';
  const head = page ? pageHead(page, published, lang, origin, rest, robots) : `<title>${esc(published.content.settings.brand?.name || 'One Style')}</title>\n  <meta name="robots" content="noindex,nofollow">`;
  doc = doc
    .replace(/<html lang="[^"]*" dir="[^"]*">/, `<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">`)
    .replace(/[ \t]*<meta name="robots"[^>]*>\r?\n?/, '')
    .replace(/[ \t]*<meta name="description"[^>]*>\r?\n?/, '')
    .replace(/<title>[^<]*<\/title>/, () => head)
    .replace(/(<a class="skip-link" href="#main">)[^<]*(<\/a>)/, (_, a, b) => `${a}${lang === 'ar' ? 'تجاوز إلى المحتوى' : 'Skip to content'}${b}`)
    .replace(/<noscript>[^<]*<\/noscript>/, () => `<noscript>${lang === 'ar' ? 'لتصفّح الأجهزة والطلب، فعّل JavaScript.' : 'Turn on JavaScript to browse and order.'}</noscript>`)
    .replace('<div id="app"></div>', () => `<div id="app">${page ? pageBody(page, published, lang) : ''}</div>`);
  return html(doc, page ? 200 : 404);
}
