// Quick checks that run without Cloudflare:   npm test
// The server prices and cleans content with the storefront's own rules (worker/src/generated,
// built from data.js + settings.js). These checks make sure that stays true.
import assert from 'node:assert/strict';
import { data, cfg } from '../worker/src/generated/shop-rules.js';
import { slugify, assignSlugs, sanitizeContent, publicCopy, indexable } from '../worker/src/content.js';
import { priceOrder, MAX_QTY, MAX_LINES } from '../worker/src/orders.js';
import { normaliseMobile, strongEnough } from '../worker/src/util.js';

let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log(`ok  ${name}`); };

const settings = cfg.clone(cfg.defaults);
const catalog = cfg.normalizeCatalog(data.products, settings);
const content = { settings, catalog, slugs: assignSlugs(catalog) };

test('the shipped catalog passes the server cleaning unchanged', () => {
  const clean = sanitizeContent({ settings, catalog });
  assert.deepEqual(clean.catalog, catalog);
  assert.deepEqual(clean.settings, settings);
});

test('ordering is off until the owner turns it on', () => {
  assert.equal(settings.checkout.ordersOn, false);
  assert.equal(indexable({ fromSeed: true, content }), false);
  assert.equal(indexable({ fromSeed: false, content }), false);
  const on = cfg.clone(content); on.settings.checkout.ordersOn = true;
  assert.equal(indexable({ fromSeed: false, content: on }), true);
});

test('every device and every choice is priced the same as the storefront', () => {
  let lines = 0;
  for (const p of catalog.filter((x) => !x.hidden && x.availability !== 'unavailable')) {
    for (const ram of p.ramOptions || [null]) {
      for (const storage of p.storageOptions || [null]) {
        for (const [fulfilment, city] of [['pickup', ''], ['delivery', 'Amman'], ['delivery', 'Other']]) {
          const r = priceOrder(content, [{ productId: p.id, color: 0, ram, storage, quantity: 2 }], fulfilment, city);
          assert.ok(!r.error, `${p.id}: ${r.error}`);
          const unit = Math.round(cfg.unitPrice(p, { color: 0, ram, storage }) * 1000);
          const fee = Math.round(cfg.deliveryFee(settings, fulfilment, city) * 1000);
          assert.equal(r.totalFils, unit * 2 + fee, p.id);
          lines += 1;
        }
      }
    }
  }
  assert.ok(lines > 20);
});

test('memory adds 9 JOD per GB step, storage 75 JOD per size step', () => {
  const p = catalog.find((x) => x.ramOptions && x.ramOptions.length > 1 && x.storageOptions && x.storageOptions.length > 1);
  assert.ok(p, 'a device with memory and storage options');
  const base = cfg.unitPrice(p, { color: 0, ram: p.ramOptions[0], storage: p.storageOptions[0] });
  const up = cfg.unitPrice(p, { color: 0, ram: p.ramOptions[1], storage: p.storageOptions[1] });
  assert.equal(up - base, (p.ramOptions[1] - p.ramOptions[0]) * 9 + 75);
});

test('orders refuse bad lines', () => {
  const ok = { productId: 'usb-c-charger', color: 0, ram: null, storage: null, quantity: 1 };
  assert.equal(priceOrder(content, [], 'pickup', '').error, 'empty');
  assert.equal(priceOrder(content, [{ ...ok, quantity: MAX_QTY + 1 }], 'pickup', '').error, 'bad-qty');
  assert.equal(priceOrder(content, [{ ...ok, quantity: 1.5 }], 'pickup', '').error, 'bad-qty');
  assert.equal(priceOrder(content, [{ ...ok, color: 99 }], 'pickup', '').error, 'unknown');
  assert.equal(priceOrder(content, [{ ...ok, storage: 256 }], 'pickup', '').error, 'unknown');
  assert.equal(priceOrder(content, [ok, ok], 'pickup', '').error, 'duplicate');
  assert.equal(priceOrder(content, Array.from({ length: MAX_LINES + 1 }, () => ok), 'pickup', '').error, 'too-many-lines');
  const hidden = cfg.clone(content); hidden.catalog.find((x) => x.id === 'usb-c-charger').hidden = true;
  assert.equal(priceOrder(hidden, [ok], 'pickup', '').error, 'unknown');
});

test('addresses: readable, unique, and a renamed public device keeps its old address', () => {
  assert.equal(slugify('MacBook Pro 14″ M1 Pro'), 'macbook-pro-14-m1-pro');
  assert.equal(slugify('  Café  ÉDITION  '), 'cafe-edition');
  assert.equal(slugify('<script>'), 'script');
  const slugs = Object.values(content.slugs).map((s) => s.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  const twins = cfg.clone(catalog).slice(0, 2); twins[1].name = twins[0].name; twins[1].chip = twins[0].chip;
  const t = assignSlugs(twins);
  assert.notEqual(t[twins[0].id].slug, t[twins[1].id].slug);
  const renamed = cfg.clone(catalog); renamed[0].name = 'Renamed Device';
  const after = assignSlugs(renamed, content.slugs);
  assert.ok(after[renamed[0].id].old.includes(content.slugs[renamed[0].id].slug));
});

test('addresses stay put when devices are reordered, and a rename back works both ways', () => {
  const twins = cfg.clone(catalog).slice(0, 2); twins[1].name = twins[0].name; twins[1].chip = twins[0].chip;
  const a = assignSlugs(twins);
  const b = assignSlugs([twins[1], twins[0]], a);
  assert.equal(b[twins[0].id].slug, a[twins[0].id].slug);
  assert.equal(b[twins[1].id].slug, a[twins[1].id].slug);
  const r = cfg.clone(catalog); const first = assignSlugs(r);
  r[0].name = 'Other Name'; const second = assignSlugs(r, first);
  r[0].name = catalog[0].name; const third = assignSlugs(r, second);
  assert.equal(third[r[0].id].slug, first[r[0].id].slug);
  assert.deepEqual(third[r[0].id].old, [second[r[0].id].slug]);
});

test('colours keep only a name and a colour code; reserved ids are refused', () => {
  const extra = cfg.clone(catalog); extra[0].colors[0].extra = '<img src=x onerror=alert(1)>';
  assert.deepEqual(Object.keys(sanitizeContent({ settings, catalog: extra }).catalog[0].colors[0]), ['name', 'hex']);
  for (const id of ['__proto__', 'constructor', 'prototype']) {
    const bad = cfg.clone(catalog); bad[1].id = id;
    assert.throws(() => sanitizeContent({ settings, catalog: bad }), (e) => e.status === 400, id);
  }
});

test('content cleaning refuses pasted pictures and bad prices', () => {
  const pasted = cfg.clone(catalog); pasted[0].image = 'data:image/png;base64,AAAA';
  assert.throws(() => sanitizeContent({ settings, catalog: pasted }), (e) => e.status === 400);
  const negative = cfg.clone(catalog); negative[0].basePrice = -1;
  assert.throws(() => sanitizeContent({ settings, catalog: negative }), (e) => e.status === 400);
  assert.throws(() => sanitizeContent(null), (e) => e.status === 400);
});

test('the public copy hides hidden devices and the address history', () => {
  const c = cfg.clone(content); c.catalog[0].hidden = true;
  const pub = publicCopy(c);
  assert.ok(!pub.catalog.some((p) => p.id === c.catalog[0].id));
  assert.ok(!(c.catalog[0].id in pub.slugs));
  assert.equal(typeof Object.values(pub.slugs)[0], 'string');
});

test('stock counts stay in the admin; a count of 0 marks the device out of stock', () => {
  const c = cfg.clone(content);
  c.catalog[1].stockCount = 4; c.catalog[2].stockCount = 0;
  const clean = cfg.normalizeCatalog(c.catalog, c.settings);
  assert.equal(clean[1].stockCount, 4);
  assert.equal(clean[2].availability, 'unavailable');
  const pub = publicCopy({ ...c, catalog: clean });
  assert.ok(pub.catalog.length > 2 && pub.catalog.every((p) => !('stockCount' in p)));
  assert.equal(pub.catalog.find((p) => p.id === clean[2].id).availability, 'unavailable');
  assert.throws(() => cfg.normalizeCatalog([{ ...clean[1], stockCount: -1 }], c.settings));
});

test('battery health and cycles: only for used devices, within range', () => {
  const c = cfg.clone(content);
  const used = { ...c.catalog[0], condition: 'used-like-new', batteryUse: 'mixed', batteryHealth: 88, batteryCycles: 240 };
  const [kept] = cfg.normalizeCatalog([used], c.settings);
  assert.equal(kept.batteryHealth, 88); assert.equal(kept.batteryCycles, 240);
  const [fresh] = cfg.normalizeCatalog([{ ...used, condition: 'new' }], c.settings);
  assert.equal(fresh.batteryHealth, null); assert.equal(fresh.batteryCycles, null);
  assert.throws(() => cfg.normalizeCatalog([{ ...used, batteryHealth: 101 }], c.settings));
});

test('Jordanian mobiles in any common form', () => {
  for (const v of ['0791234567', '791234567', '+962791234567', '00962 79 123 4567', '٠٧٩١٢٣٤٥٦٧']) assert.equal(normaliseMobile(v), '0791234567', v);
  for (const v of ['12345', '0761234567', '+9627912345678', '']) assert.equal(normaliseMobile(v), null, v);
});

test('passwords: 16 to 200 characters', () => {
  assert.equal(strongEnough('x'.repeat(15)), false);
  assert.equal(strongEnough('x'.repeat(16)), true);
  assert.equal(strongEnough('x'.repeat(201)), false);
});

console.log(`\n${passed} checks passed`);
