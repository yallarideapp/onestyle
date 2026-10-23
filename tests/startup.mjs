// Exercise the live bootstrap with delayed requests, scripts and a deterministic clock.
// This is a VM fixture, not a browser: it checks recovery and never contacts the network.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { renderPage } from '../worker/src/pages.js';
import { startupShell } from '../worker/src/startup.js';
import { cfg, dropCache } from '../worker/src/content.js';
import { data } from '../worker/src/generated/shop-rules.js';

const source = await readFile(new URL('../live.js', import.meta.url), 'utf8');
const shell = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const scripts = ['/data.js?v=test', '/settings.js?v=test', '/admin.js?v=test', '/app.js?v=test'];
const published = { version: 7, content: { settings: {}, catalog: [{ id: 'published-device', name: 'Published stock' }], slugs: { 'published-device': 'published-stock' } } };
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
let passed = 0;
async function test(name, fn) { await fn(); passed += 1; console.log(`ok  ${name}`); }

function fixture({ language = 'en', pathname = '/' } = {}) {
  let now = 0;
  let sequence = 0;
  let reloads = 0;
  const timers = new Map();
  const requests = new Map();
  const inserted = [];
  const classes = new Set();
  const status = { textContent: '' };
  const retry = { hidden: true, listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } };
  const details = { open: false };
  const startup = {
    classList: { add: (...names) => names.forEach((name) => classes.add(name)), remove: (...names) => names.forEach((name) => classes.delete(name)), contains: (name) => classes.has(name) },
    querySelector: (selector) => ({ '[data-startup-status]': status, '[data-startup-retry]': retry, details }[selector] || null),
  };
  const app = { children: [startup], replaceChildren(...nodes) { this.children = nodes; } };
  const body = { querySelectorAll: () => [] };
  const skip = { textContent: '' };
  const document = {
    currentScript: { dataset: { scripts: scripts.join(' ') } },
    documentElement: { lang: language },
    body,
    head: { appendChild(node) { inserted.push(node); return node; } },
    querySelector: (selector) => ({ '.live-startup': startup, '.skip-link': skip }[selector] || null),
    getElementById: (id) => id === 'app' ? app : null,
    createElement: (tagName) => ({ tagName }),
    addEventListener() {},
  };
  const location = { pathname, hash: '', search: '', origin: 'https://store.example', reload: () => { reloads += 1; } };
  const window = { addEventListener() {} };
  const context = vm.createContext({
    document, location, window,
    history: { replaceState() {}, pushState() {} },
    localStorage: { getItem: () => null },
    MutationObserver: class { observe() {} },
    AbortController, crypto: webcrypto,
    setTimeout(fn, delay) { const id = ++sequence; timers.set(id, { at: now + delay, fn }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch(path, options) {
      assert.ok(!requests.has(path), `unexpected duplicate request: ${path}`);
      return new Promise((resolve, reject) => {
        const request = { options, resolve, reject, aborted: false };
        options.signal?.addEventListener('abort', () => { request.aborted = true; reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
        requests.set(path, request);
      });
    },
  });
  vm.runInContext(source, context, { filename: 'live.js' });
  return {
    app, startup, status, retry, details, classes, inserted, requests, timers, live: window.OneStyleLive,
    get reloads() { return reloads; },
    async reply(path, value, statusCode = 200) {
      const request = requests.get(path);
      assert.ok(request, `request started: ${path}`);
      request.resolve({ ok: statusCode >= 200 && statusCode < 300, status: statusCode, json: async () => value });
      await flush();
    },
    async reject(path) { requests.get(path).reject(new Error('offline')); await flush(); },
    async startContent() { await this.reply('/api/content', published); await this.reply('/api/customer/session', { signedIn: false }); },
    async load(index, { render = false, error = false, partial = false } = {}) {
      const script = inserted[index];
      assert.ok(script, `script ${index} was requested`);
      if (partial) app.replaceChildren({ broken: true });
      if (render) {
        app.replaceChildren({ storefront: true });
        this.live.attach({ lang: () => language });
        this.live.afterRender();
      }
      (error ? script.onerror : script.onload)();
      await flush();
    },
    async advance(ms) {
      const until = now + ms;
      while (true) {
        const next = [...timers.entries()].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!next) break;
        const [id, timer] = next;
        now = timer.at; timers.delete(id); timer.fn();
        await flush();
      }
      now = until;
      await flush();
    },
  };
}

function failed(f) {
  assert.equal(f.app.children.length, 1);
  assert.equal(f.app.children[0], f.startup, 'restore the original public fallback, even after a partial render');
  assert.ok(f.classes.has('is-failed'));
  assert.ok(!f.classes.has('is-loading'));
  assert.equal(f.details.open, true, 'native device catalogue is available immediately');
  assert.equal(f.retry.hidden, false);
  assert.ok(f.status.textContent.length > 20, 'failure explains how to continue');
}

await test('pending content keeps the branded loading state and does not run bundled stock', async () => {
  const f = fixture();
  assert.ok(f.classes.has('is-loading'));
  assert.equal(f.details.open, false);
  assert.equal(f.retry.hidden, true);
  assert.equal(f.app.children[0], f.startup);
  assert.equal(f.inserted.length, 0);
  assert.equal(f.live.content, null);
  await f.reply('/api/customer/session', { signedIn: false });
  await f.advance(2000);
  assert.equal(f.inserted.length, 0, 'session response cannot start the sample catalogue');
  assert.ok(f.status.textContent.includes('Getting'));
});

await test('published content loads dependency scripts one at a time and a completed render stays ready', async () => {
  const f = fixture();
  await f.startContent();
  assert.equal(f.live.content.catalog[0].id, 'published-device');
  assert.equal(f.live.version, 7);
  for (let i = 0; i < scripts.length; i++) {
    assert.equal(f.inserted.length, i + 1);
    assert.equal(f.inserted[i].src, scripts[i]);
    assert.equal(f.inserted[i].async, false);
    await f.load(i, { render: i === scripts.length - 1 });
  }
  assert.equal(f.timers.size, 0, 'successful fetches and rendering clear every recovery timer');
  await f.advance(30000);
  assert.equal(f.app.children[0].storefront, true);
  assert.ok(!f.classes.has('is-failed'));
});

await test('network, HTTP and malformed content failures reveal the real fallback instead of sample stock', async () => {
  for (const failure of ['network', 'http', 'missing', 'invalid-catalog']) {
    const f = fixture();
    await f.reply('/api/customer/session', { signedIn: false });
    if (failure === 'network') await f.reject('/api/content');
    else if (failure === 'http') await f.reply('/api/content', { error: 'unavailable' }, 503);
    else await f.reply('/api/content', failure === 'missing' ? null : { content: { settings: {}, catalog: null } });
    failed(f);
    assert.equal(f.inserted.length, 0, failure);
    assert.equal(f.live.content, null, failure);
    f.retry.listeners.click();
    assert.equal(f.reloads, 1, 'retry performs a fresh navigation');
    assert.equal(f.timers.size, 0);
  }
});

await test('a stalled session is aborted without blocking the published storefront', async () => {
  const f = fixture();
  await f.reply('/api/content', published);
  const session = f.requests.get('/api/customer/session');
  assert.ok(session.options.signal instanceof AbortSignal);
  await f.advance(3999);
  assert.equal(f.inserted.length, 0);
  await f.advance(1);
  assert.equal(session.aborted, true);
  assert.equal(f.inserted[0].src, scripts[0]);
  assert.equal(f.live.content.catalog[0].id, 'published-device');
  assert.equal(f.retry.hidden, true);
});

await test('stalled catalogue requests are bounded and never start the interactive sample shop', async () => {
  const f = fixture();
  await f.reply('/api/customer/session', { signedIn: false });
  const content = f.requests.get('/api/content');
  assert.ok(content.options.signal instanceof AbortSignal);
  await f.advance(7999);
  assert.equal(content.aborted, false);
  await f.advance(1);
  assert.equal(content.aborted, true);
  failed(f);
  assert.equal(f.inserted.length, 0);
  assert.equal(f.timers.size, 0);
});

await test('a missing dependency restores the original fallback and stops subsequent scripts', async () => {
  const f = fixture();
  await f.startContent();
  await f.load(0);
  await f.load(1, { error: true, partial: true });
  failed(f);
  assert.equal(f.inserted.length, 2);
  assert.equal(f.timers.size, 0);
});

await test('an app that loads but fails before its render callback cannot leave a blank page', async () => {
  const f = fixture();
  await f.startContent();
  for (let i = 0; i < scripts.length; i++) await f.load(i, { partial: i === scripts.length - 1 });
  failed(f);
  assert.equal(f.timers.size, 0);
});

await test('the overall deadline recovers from a hung dependency and prevents any later dependency', async () => {
  const f = fixture();
  await f.startContent();
  await f.advance(15000);
  failed(f);
  await f.load(0);
  assert.equal(f.inserted.length, 1, 'a very late dependency must not resume startup after recovery');
});

await test('a final app script that renders after the deadline can recover the real storefront', async () => {
  const f = fixture();
  await f.startContent();
  for (let i = 0; i < scripts.length - 1; i++) await f.load(i);
  await f.advance(15000);
  failed(f);
  await f.load(scripts.length - 1, { render: true });
  await f.advance(30000);
  assert.equal(f.app.children[0].storefront, true);
  assert.equal(f.timers.size, 0);
});

await test('Arabic loading and recovery messages remain Arabic', async () => {
  const f = fixture({ language: 'ar', pathname: '/ar' });
  assert.match(f.status.textContent, /جارٍ/);
  await f.reply('/api/customer/session', { signedIn: false });
  await f.reject('/api/content');
  failed(f);
  assert.match(f.status.textContent, /تعذّر/);
});

await test('the static build also has a usable branded fallback if page rendering or the loader fails', () => {
  const app = shell.match(/<div id="app">([\s\S]*?)<!--\/live-startup--><\/div>/)?.[1];
  assert.ok(app, 'the built asset does not start with an empty application root');
  assert.ok(app.includes('Apple specialized'));
  assert.match(app, /<details\b[^>]*>[\s\S]*<summary>[^<]+<\/summary>/);
  assert.ok(app.includes('معلومات الأجهزة غير متاحة مؤقتًا'));
  assert.match(app, /href="\/ar"/);
});

await test('startup branding escapes owner text and keeps uploaded images absolute on deep paths', () => {
  const html = startupShell({ name: '<Shop & "brand">', logoImage: 'api/photo/1234' }, 'ar', '<p>Published product information</p>');
  assert.match(html, /src="\/api\/photo\/1234"/);
  assert.ok(!html.includes('src="api/photo/1234"'));
  assert.ok(html.includes('alt="&lt;Shop &amp; &quot;brand&quot;&gt;"'));
  assert.ok(!html.includes('<Shop'));
  assert.ok(html.includes('تصفّح الأجهزة'));
  assert.ok(html.includes('إعادة المحاولة'));
  assert.match(html, /<details\s+class="live-startup-catalog">/);
  assert.ok(html.includes('<p>Published product information</p>'));
  assert.ok(startupShell({ name: '<Shop>' }).includes('&lt;Shop&gt;'));
});

const settings = cfg.clone(cfg.defaults);
const catalog = cfg.normalizeCatalog(data.products, settings);
const row = { version: 3, body: JSON.stringify({ settings, catalog, slugs: Object.fromEntries(catalog.map((p) => [p.id, { slug: p.id }])) }) };
async function responseFor(pathname) {
  dropCache();
  const url = new URL(pathname, 'https://store.example');
  return renderPage(new Request(url), {
    SITE_URL: url.origin,
    DB: { prepare: () => ({ first: async () => row }) },
    ASSETS: { fetch: async () => new Response(shell, { headers: { 'Content-Type': 'text/html' } }) },
  }, url);
}

await test('server first paint includes branding and a native no-script catalogue with real product links', async () => {
  const response = await responseFor('/');
  assert.equal(response.status, 200);
  const html = await response.text();
  const fallback = html.match(/<details\b[^>]*>([\s\S]*?)<\/details>/)?.[1];
  assert.ok(fallback, 'native details supports browsing with no script');
  assert.ok(html.includes('Apple specialized'));
  assert.ok(fallback.includes(catalog[0].name));
  assert.ok(fallback.includes(`/devices/${catalog[0].id}`));
  assert.ok(fallback.includes(`${cfg.startPrice(catalog[0])} JOD`));
  assert.match(html, /rel="canonical" href="https:\/\/store\.example\/"/);
  assert.match(html, /application\/ld\+json/);
  assert.ok(!response.headers.get('Content-Security-Policy').includes("script-src 'self' 'unsafe-inline'"));
});

await test('Arabic and missing server pages keep their direction, status and indexing contract', async () => {
  const arabic = await responseFor('/ar/shop');
  assert.equal(arabic.status, 200);
  const html = await arabic.text();
  assert.match(html, /<html lang="ar" dir="rtl">/);
  assert.ok(html.includes('تصفّح الأجهزة'));
  assert.ok(html.includes(`/ar/devices/${catalog[0].id}`));
  const missing = await responseFor('/missing-category');
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /name="robots" content="noindex,nofollow"/);
});

console.log(`\n${passed} startup checks passed.`);
