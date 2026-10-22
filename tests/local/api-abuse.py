"""Abuse tests for the One Style Worker API, on a fresh local Worker: sh tests/local/run.sh python3 tests/local/api-abuse.py.
   python3 api-abuse.py [port] [mail.jsonl]"""
import http.client, json, sys, threading, secrets, random, time, re, os
HOST, PORT = '127.0.0.1', int(sys.argv[1]) if len(sys.argv) > 1 else 8788
MAIL = sys.argv[2] if len(sys.argv) > 2 else os.environ.get('ONESTYLE_MAIL', '.wrangler/test-mail.jsonl')
ORIGIN = f'http://{HOST}:{PORT}'
CODE, PASS = 'test-setup-code-1234567890', 'onestyle-admin-pass-2026'
results = []
def ip(): return f'10.{random.randint(20, 200)}.{random.randint(0, 255)}.{random.randint(1, 254)}'
def req(method, path, body=None, headers=None, raw=None):
    for attempt in range(2):
        try:
            c = http.client.HTTPConnection(HOST, PORT, timeout=30)
            h = {'Origin': ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip()}
            h.update(headers or {}); h = {k: v for k, v in h.items() if v is not None}
            data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
            c.request(method, path, body=data, headers=h)
            r = c.getresponse(); t = r.read().decode('utf-8', 'replace')
            try: j = json.loads(t)
            except Exception: j = None
            return r.status, j, dict(r.getheaders()), t
        except (ConnectionError, http.client.RemoteDisconnected):
            if attempt: raise
def check(name, cond, info=''):
    cond = bool(cond); results.append(cond); print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else f'  [{str(info)[:300]}]'))
cookie = lambda h: (h.get('Set-Cookie') or '').split(';')[0]
def mails():
    if not os.path.exists(MAIL): return []
    return [json.loads(l) for l in open(MAIL) if l.strip()]

# ---------- before the shop is set up ----------
s, j, _, _ = req('GET', '/api/content'); check('content before the first publish: published=false', s == 200 and j['published'] is False and j['version'] == 0, j and j.get('published'))
catalog = j['content']['catalog']
s, j, h, t = req('GET', '/robots.txt'); check('robots.txt blocks everything before ordering is on', s == 200 and 'Disallow: /\n' in t, t)
s, j, h, t = req('GET', '/sitemap.xml'); check('no sitemap before ordering is on', s == 404, s)
s, j, h, t = req('GET', '/devices/macbook-pro-14-m1-pro'); check('device page before ordering: readable but noindex', s == 200 and 'noindex,nofollow' in t and 'MacBook Pro' in t, s)
def price(pid, ram=None, storage=None):
    p = next(x for x in catalog if x['id'] == pid)
    start = p['offerPrice'] if isinstance(p.get('offerPrice'), (int, float)) and 0 < p['offerPrice'] < p['basePrice'] else p['basePrice']
    extra = 0
    if p.get('ramOptions') and ram is not None: extra += (ram - p['ramOptions'][0]) * 9
    if p.get('storageOptions') and storage is not None: extra += p['storageOptions'].index(storage) * 75
    return round((start + extra) * 1000)
CHARGER = price('usb-c-charger')
def order(**over):
    o = {'token': secrets.token_hex(16), 'lines': [{'productId': 'usb-c-charger', 'color': 0, 'ram': None, 'storage': None, 'quantity': 1}], 'totalFils': CHARGER,
         'customer': {'name': 'Abuse Test', 'phone': '0791234567', 'city': 'Amman', 'address': 'Test address 1', 'notes': ''}, 'fulfilment': 'delivery', 'lang': 'ar', 'website': '', 'elapsedMs': 5000}
    o.update(over); return o
s, j, _, _ = req('POST', '/api/order', order()); check('ordering off: order refused', s == 403 and j['error'] == 'orders-off', (s, j))
s, j, _, _ = req('POST', '/api/admin/login', {'password': PASS}); check('login before setup -> not-setup', s == 409, (s, j))
s, j, _, _ = req('GET', '/api/admin/status'); check('status: not set up', j == {'setup': False, 'signedIn': False, 'resetAvailable': True}, j)
sip = {'CF-Connecting-IP': f'10.249.{random.randint(0, 255)}.{random.randint(1, 254)}'}
codes = [req('POST', '/api/admin/setup', {'code': f'wrong-code-{i}', 'password': PASS}, sip)[0] for i in range(6)]
check('setup locks after 5 wrong codes from one IP', codes[:5] == [403] * 5 and codes[5] == 429, codes)
s, j, h, _ = req('POST', '/api/admin/setup', {'code': CODE, 'password': 'nine-char'}); check('setup with a 9-character password refused', s == 400 and j['error'] == 'weak-admin-password', (s, j))
s, j, h, _ = req('POST', '/api/admin/setup', {'code': CODE, 'password': PASS}, {'Origin': 'https://evil.example'}); check('setup from a foreign Origin refused', s == 403, s)
s, j, h, _ = req('POST', '/api/admin/setup', {'code': CODE, 'password': PASS}); A = {'Cookie': cookie(h)}
sc = h.get('Set-Cookie', '')
check('setup signs in with an HttpOnly Secure SameSite=Strict admin cookie on /api/admin', s == 200 and all(x in sc for x in ('HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/api/admin', 'onestyle_admin=')), sc)
s, j, _, _ = req('POST', '/api/admin/setup', {'code': CODE, 'password': 'another-long-password'}); check('second setup refused', s == 409, (s, j))

# ---------- publishing ----------
s, j, _, _ = req('GET', '/api/admin/content', headers=A); base = j['version']; content = j['content']
check('admin content carries address history', 'slugs' in content and content['slugs']['macbook-pro-14-m1']['slug'] == 'macbook-pro-14-m1-pro', content.get('slugs', {}).get('macbook-pro-14-m1'))
on = json.loads(json.dumps(content)); on['settings']['checkout']['ordersOn'] = True
s, j, _, _ = req('PUT', '/api/admin/content', {'baseVersion': base, 'content': on}, A); check('turn ordering on', s == 200 and j['content']['settings']['checkout']['ordersOn'] is True, (s, j and j.get('error')))
ver = j['version']; content = j['content']
s2, j2, _, _ = req('PUT', '/api/admin/content', {'baseVersion': ver - 1, 'content': content}, A); check('publish on an old version -> 409', s2 == 409 and j2['error'] == 'conflict', (s2, j2))
def put_bad(mutate, name, expect_field=None):
    bad = json.loads(json.dumps(content)); mutate(bad)
    s2, j2, _, _ = req('PUT', '/api/admin/content', {'baseVersion': ver, 'content': bad}, A)
    check(name, s2 == 400 and (expect_field is None or j2.get('field') == expect_field), (s2, j2))
put_bad(lambda c: c['catalog'][0].__setitem__('basePrice', -5), 'negative price refused')
put_bad(lambda c: c['catalog'][0].__setitem__('basePrice', 'free'), 'text price refused')
put_bad(lambda c: c['catalog'][1].__setitem__('id', c['catalog'][0]['id']), 'duplicate device id refused')
put_bad(lambda c: c['catalog'][0].__setitem__('image', 'data:image/png;base64,AAAA'), 'inline data: image refused')
put_bad(lambda c: c.__setitem__('catalog', 'nope'), 'catalog that is not a list refused')
put_bad(lambda c: c['settings']['checkout'].__setitem__('otherFee', -1), 'negative delivery fee refused')
s2, j2, _, _ = req('PUT', '/api/admin/content', raw=b'{"baseVersion":1,"content":' + b'"' + b'x' * (950 * 1024) + b'"}', headers=A); check('content over 900 KB refused', s2 == 413, s2)
hostile = json.loads(json.dumps(content))
hostile['catalog'][0]['name'] = '</title><script>alert(1)</script> "q"'
hostile['catalog'][0]['image'] = 'javascript:alert(1)'; hostile['catalog'][0]['evil'] = 'x'
hostile['settings']['brand']['instagram'] = 'http://insecure.example'
s2, j2, _, _ = req('PUT', '/api/admin/content', {'baseVersion': ver, 'content': hostile}, A)
check('hostile content is cleaned or refused, never stored as is', s2 in (200, 400), (s2, j2))
if s2 == 200:
    ver = j2['version']; p0 = j2['content']['catalog'][0]
    check('javascript: image and unknown field dropped', not p0['image'].startswith('javascript') and 'evil' not in p0, p0.get('image'))
    check('non-https link dropped from settings', j2['content']['settings']['brand']['instagram'] in ('', content['settings']['brand']['instagram']), j2['content']['settings']['brand']['instagram'])
    s3, _, _, t3 = req('GET', '/api/content'); check('hostile name escaped in JSON', '<script>' not in t3 and '</title>' not in t3, t3[:100])
    slug0 = j2['content']['slugs'][p0['id']]['slug']
    s4, _, _, t4 = req('GET', f'/devices/{slug0}')
    check('hostile name escaped on the device page', s4 == 200 and '<script>alert(1)</script>' not in t4 and '&lt;/title&gt;' in t4, s4)
    s5, j5, _, _ = req('PUT', '/api/admin/content', {'baseVersion': ver, 'content': content}, A); ver = j5['version']; content = j5['content']
    s6, _, h6, _ = req('GET', f'/devices/{slug0}')
    check('restore content; the old address redirects, cached a day only', s5 == 200 and s6 == 301 and h6.get('Cache-Control') == 'public, max-age=86400', (s5, s6, h6.get('Cache-Control')))
# hidden device: not public, cannot be ordered
hid = json.loads(json.dumps(content)); hp = next(p for p in hid['catalog'] if p['id'] == 'airpods-pro-2'); hp['hidden'] = True
s2, j2, _, _ = req('PUT', '/api/admin/content', {'baseVersion': ver, 'content': hid}, A); ver = j2['version']; content = j2['content']
s3, j3, _, _ = req('GET', '/api/content')
check('hidden device left out of the public content and addresses', all(p['id'] != 'airpods-pro-2' for p in j3['content']['catalog']) and 'airpods-pro-2' not in j3['content']['slugs'], [p['id'] for p in j3['content']['catalog']])
s, j, _, _ = req('POST', '/api/order', order(lines=[{'productId': 'airpods-pro-2', 'color': 0, 'ram': None, 'storage': None, 'quantity': 1}], totalFils=169000))
check('hidden device cannot be ordered', s == 409 and j['error'] == 'unknown', (s, j))
check('hidden device page -> 404', req('GET', '/devices/airpods-pro-2-h2')[0] == 404)
s, j, h, t = req('GET', '/sitemap.xml'); check('sitemap leaves out the hidden device', s == 200 and 'airpods' not in t and '/devices/usb-c-charger-20-w' in t, s)
s, j, h, t = req('GET', '/robots.txt'); check('robots.txt opens the shop and keeps admin/account/api out', 'Disallow: /admin' in t and 'Disallow: /api/' in t and 'Disallow: /account' in t and 'Sitemap:' in t, t)
# sold-out device
so = json.loads(json.dumps(content)); next(p for p in so['catalog'] if p['id'] == 'usb-c-charger')['availability'] = 'unavailable'
s2, j2, _, _ = req('PUT', '/api/admin/content', {'baseVersion': ver, 'content': so}, A); ver = j2['version']
s, j, _, _ = req('POST', '/api/order', order()); check('sold-out device cannot be ordered', s == 409 and j['error'] == 'sold-out', (s, j))
s2, j2, _, _ = req('PUT', '/api/admin/content', {'baseVersion': ver, 'content': content}, A); ver = j2['version']; content = j2['content']
check('restore after sold-out test', s2 == 200, (s2, j2))
# stock count (admin only; 0 = out of stock) and a used device's battery condition
st = json.loads(json.dumps(content))
next(p for p in st['catalog'] if p['id'] == 'usb-c-charger')['stockCount'] = 0
mb = next(p for p in st['catalog'] if p['id'] == 'macbook-pro-14-m1')
mb.update({'stockCount': 5, 'condition': 'used-like-new', 'batteryUse': 'mixed', 'batteryHealth': 88, 'batteryCycles': 240})
s2, j2, _, _ = req('PUT', '/api/admin/content', {'baseVersion': ver, 'content': st}, A); ver = j2['version']
s3, j3, _, _ = req('GET', '/api/content'); s4, j4, _, _ = req('GET', '/api/admin/content', headers=A)
pub_charger = next(p for p in j3['content']['catalog'] if p['id'] == 'usb-c-charger')
check('stock counts kept for the admin, left out of the public content', s2 == 200 and all('stockCount' not in p for p in j3['content']['catalog']) and next(p for p in j4['content']['catalog'] if p['id'] == 'macbook-pro-14-m1').get('stockCount') == 5, (s2, j2 and j2.get('error')))
check('stock count 0 shows the device as out of stock', pub_charger['availability'] == 'unavailable', pub_charger.get('availability'))
s, j, _, _ = req('POST', '/api/order', order()); check('device with stock count 0 cannot be ordered', s == 409 and j['error'] == 'sold-out', (s, j))
s, _, _, t = req('GET', '/devices/macbook-pro-14-m1-pro'); s5, _, _, t5 = req('GET', '/ar/devices/macbook-pro-14-m1-pro')
check('used device page lists battery health and cycles', s == 200 and 'Battery health 88%' in t and 'Battery cycles 240' in t and s5 == 200 and 'صحة البطارية 88%' in t5, (s, s5))
s2, j2, _, _ = req('PUT', '/api/admin/content', {'baseVersion': ver, 'content': content}, A); ver = j2['version']; content = j2['content']
check('restore after stock test', s2 == 200, (s2, j2))

# ---------- orders ----------
s, j, h, _ = req('POST', '/api/order', order(), {'Origin': 'https://evil.example'}); check('foreign Origin refused', s == 403 and j['error'] == 'bad-origin', s)
s, j, h, _ = req('POST', '/api/order', order(), {'Origin': None}); check('missing Origin + no Sec-Fetch-Site refused', s == 403, s)
s, j, h, _ = req('POST', '/api/order', order(), {'Origin': None, 'Sec-Fetch-Site': 'same-origin'}); check('Sec-Fetch-Site same-origin accepted', s == 201 and re.fullmatch(r'OS-\d{4}', j['number']), (s, j))
s, j, h, _ = req('POST', '/api/order', order(), {'Content-Type': 'text/plain'}); check('wrong content type refused', s == 415, s)
s, j, h, _ = req('POST', '/api/order', raw=b'{"a":"' + b'x' * 20000 + b'"}'); check('oversized body refused', s == 413, s)
s, j, h, _ = req('POST', '/api/order', raw=b'{not json'); check('bad JSON refused', s == 400 and j['error'] == 'bad-json', (s, j))
s, j, h, _ = req('POST', '/api/order', raw=b'null'); check('JSON null body -> 400', s == 400, (s, j))
s, j, h, _ = req('POST', '/api/order', raw=b'[1,2]'); check('JSON array body -> 400', s == 400, (s, j))
s, j, h, _ = req('POST', '/api/order', order(totalFils=1000)); check('price tampering refused', s == 409 and j['error'] == 'price-changed', (s, j))
s, j, h, _ = req('POST', '/api/order', order(totalFils=CHARGER + 0.5)); check('fractional total refused', s == 409, (s, j))
s, j, h, _ = req('POST', '/api/order', order(lines=[{'productId': 'usb-c-charger', 'color': 0, 'quantity': 21}], totalFils=CHARGER * 21)); check('quantity above 20 refused', s == 400 and j['error'] == 'bad-qty', (s, j))
s, j, h, _ = req('POST', '/api/order', order(lines=[{'productId': 'usb-c-charger', 'color': 0, 'quantity': 1.5}], totalFils=round(CHARGER * 1.5))); check('fractional quantity refused', s == 400 and j['error'] == 'bad-qty', (s, j))
s, j, h, _ = req('POST', '/api/order', order(lines=[{'productId': 'usb-c-charger', 'color': 0, 'quantity': -1}], totalFils=-CHARGER)); check('negative quantity refused', s == 400, (s, j))
s, j, h, _ = req('POST', '/api/order', order(lines=[{'productId': 'nope', 'color': 0, 'quantity': 1}])); check('unknown device refused', s == 409 and j['error'] == 'unknown', (s, j))
s, j, h, _ = req('POST', '/api/order', order(lines=[{'productId': 'usb-c-charger', 'color': 99, 'quantity': 1}])); check('unknown colour refused', s == 409 and j['error'] == 'unknown', (s, j))
s, j, h, _ = req('POST', '/api/order', order(lines=[{'productId': 'iphone-15', 'color': 0, 'storage': 1024, 'quantity': 1}], totalFils=price('iphone-15', storage=512) + 150000)); check('storage size the device does not offer refused', s == 409 and j['error'] == 'unknown', (s, j))
s, j, h, _ = req('POST', '/api/order', order(lines=[{'productId': 'iphone-15', 'color': 0, 'ram': 64, 'storage': 128, 'quantity': 1}], totalFils=price('iphone-15', storage=128))); check('memory on a device without memory options refused', s == 409, (s, j))
s, j, h, _ = req('POST', '/api/order', order(lines=[{'productId': 'iphone-15', 'color': 1, 'storage': 256, 'quantity': 2}], totalFils=price('iphone-15', storage=256) * 2)); check('device with a storage choice priced on the server', s == 201, (s, j))
mac = next(p for p in catalog if p['id'] == 'macbook-pro-14-m1')
if mac.get('ramOptions') and len(mac['ramOptions']) > 1:
    r2 = mac['ramOptions'][1]; st = (mac.get('storageOptions') or [None])[-1]
    s, j, h, _ = req('POST', '/api/order', order(lines=[{'productId': mac['id'], 'color': 0, 'ram': r2, 'storage': st, 'quantity': 1}], totalFils=price(mac['id'], ram=r2, storage=st)))
    check('memory + storage upgrade priced like the storefront', s == 201, (s, j))
s, j, h, _ = req('POST', '/api/order', order(lines=[{'productId': 'usb-c-charger', 'color': 0, 'quantity': 1}] * 2, totalFils=CHARGER * 2)); check('duplicate lines refused', s == 400 and j['error'] == 'duplicate', (s, j))
s, j, h, _ = req('POST', '/api/order', order(lines=[{'productId': f'x{i}', 'color': 0, 'quantity': 1} for i in range(21)])); check('more than 20 lines refused', s == 400 and j['error'] == 'too-many-lines', (s, j))
s, j, h, _ = req('POST', '/api/order', order(lines=[])); check('empty bag refused', s == 400 and j['error'] == 'empty', (s, j))
s, j, h, _ = req('POST', '/api/order', order(elapsedMs=200)); check('too-fast submit refused', s == 400 and j['error'] == 'too-fast', (s, j))
s, j, h, _ = req('POST', '/api/order', order(website='http://spam')); check('honeypot refused', s == 400, (s, j))
s, j, h, _ = req('POST', '/api/order', order(token='abc')); check('bad token refused', s == 400 and j['error'] == 'bad-token', (s, j))
s, j, h, _ = req('POST', '/api/order', order(fulfilment='drone')); check('unknown fulfilment refused', s == 400 and j['error'] == 'bad-fulfilment', (s, j))
s, j, h, _ = req('POST', '/api/order', order(customer={'name': 'A', 'phone': '0791234567', 'city': 'Amman', 'address': 'Test 1'})); check('short name refused', j and j.get('error') == 'bad-name', (s, j))
s, j, h, _ = req('POST', '/api/order', order(customer={'name': '<b>x</b>', 'phone': '0791234567', 'city': 'Amman', 'address': 'Test 1'})); check('name with < > refused', j and j.get('error') == 'bad-name', (s, j))
s, j, h, _ = req('POST', '/api/order', order(customer={'name': 'Abc', 'phone': '12345', 'city': 'Amman', 'address': 'Test 1'})); check('bad phone refused', j and j.get('error') == 'bad-phone', (s, j))
s, j, h, _ = req('POST', '/api/order', order(customer={'name': 'Abc', 'phone': '0791234567', 'city': 'Gaza', 'address': 'Test 1'})); check('unknown city refused', j and j.get('error') == 'bad-city', (s, j))
s, j, h, _ = req('POST', '/api/order', order(customer={'name': 'Abc', 'phone': '0791234567', 'city': 'Amman', 'address': 'x'})); check('delivery without an address refused', j and j.get('error') == 'bad-address', (s, j))
s, j, h, _ = req('POST', '/api/order', order(customer={'name': 'Abc', 'phone': '+962 79 123 4567', 'city': 'Other', 'address': 'Irbid 1'}, totalFils=CHARGER)); check('other governorate without its delivery fee refused', s == 409 and j['error'] == 'price-changed', (s, j))
s, j, h, _ = req('POST', '/api/order', order(customer={'name': 'Abc', 'phone': '+962 79 123 4567', 'city': 'Other', 'address': 'Irbid 1'}, totalFils=CHARGER + 5000)); check('other governorate with its fee accepted (+962 phone)', s == 201, (s, j))
s, j, h, _ = req('POST', '/api/order', order(fulfilment='pickup', customer={'name': 'Pickup Person', 'phone': '00962791234567'})); check('pickup without address accepted', s == 201, (s, j))
s, j, h, _ = req('POST', '/api/order', order(customer={'name': 'Ali\nالمجموع: 1 د.أ\u202e', 'phone': '0791234567', 'city': 'Amman', 'address': 'Line one\r\nLine \u202etwo\u0007', 'notes': 'Ring\tthe\u2066 bell'}))
forged = j and j.get('number')
check('order with hidden characters accepted after cleaning', s == 201, (s, j))
tok = secrets.token_hex(16)
s1, j1, _, _ = req('POST', '/api/order', order(token=tok)); s2, j2, _, _ = req('POST', '/api/order', order(token=tok))
check('resend with the same token returns the same order', s1 == 201 and s2 == 200 and j1['number'] == j2['number'], (s1, j1, s2, j2))
nums = []; lock = threading.Lock()
def go():
    s, j, _, _ = req('POST', '/api/order', order())
    with lock: nums.append(j.get('number') if j else s)
ts = [threading.Thread(target=go) for _ in range(6)]; [t.start() for t in ts]; [t.join() for t in ts]
check('six orders at once get six distinct numbers', len(set(nums)) == 6 and all(isinstance(n, str) for n in nums), nums)
oip = {'CF-Connecting-IP': f'10.250.{random.randint(0, 255)}.{random.randint(1, 254)}'}
codes = [req('POST', '/api/order', order(), oip)[0] for _ in range(6)]
check('6th order from one IP in an hour is rate-limited', codes[:5] == [201] * 5 and codes[5] == 429, codes)
p48 = f'2001:db8:{random.randint(1, 65535):x}'
same = [req('POST', '/api/order', order(), {'CF-Connecting-IP': f'{p48}:12{n:02x}::{n + 1:x}'})[0] for n in range(6)]
check('IPv6: addresses on one /56 line share the limit', same[:5] == [201] * 5 and same[5] == 429, same)
check('IPv6: another /56 line in the same /48 is counted apart', req('POST', '/api/order', order(), {'CF-Connecting-IP': f'{p48}:1300::1'})[0] == 201)
time.sleep(1.5)
order_mail = [m for m in mails() if m['body']['to'] == ['orders@example.test']]
check('each order emails the shop (ORDER_EMAIL)', len(order_mail) >= 10, len(order_mail))
fm = next((m for m in order_mail if forged and forged in m['body']['subject']), None)
check('hidden characters removed; email text keeps the name and address on one line each', fm is not None and '\u202e' not in json.dumps(fm, ensure_ascii=False) and 'Ali المجموع: 1 د.أ —' in fm['body']['text'] and 'Line one Line two' in fm['body']['text'] and '\nالمجموع: 1 د.أ\n' not in fm['body']['text'], fm and fm['body']['text'][:200])
check('order email escapes and carries the order number', all('<script' not in m['body']['html'] and re.search(r'OS-\d{4}', m['body']['subject']) for m in order_mail), order_mail[:1])

# ---------- admin, signed in ----------
s, j, _, _ = req('GET', '/api/admin/orders', headers=A); check('admin order list', s == 200 and len(j['orders']) >= 10 and all(re.fullmatch(r'OS-\d{4}', o['id']) for o in j['orders']), s)
first = j['orders'][-1]['id']
check('order list carries the shape the admin pages use', set(j['orders'][0]) >= {'id', 'date', 'status', 'customer', 'items', 'subtotal', 'shipping', 'total', 'account'}, list(j['orders'][0]))
s, j, _, _ = req('GET', '/api/admin/orders?status=hacked', headers=A); check('unknown status filter refused', s == 400, s)
s, j, _, _ = req('GET', '/api/admin/orders?before=-1', headers=A); check('bad cursor refused', s == 400, s)
s2, j2, _, _ = req('PATCH', f'/api/admin/orders/{first}', {'status': 'hacked'}, A); check('unknown order status refused', s2 == 400, (s2, j2))
s2, j2, _, _ = req('PATCH', f'/api/admin/orders/{first}', {'note': 123}, A); check('non-text note refused', s2 == 400, (s2, j2))
s2, j2, _, _ = req('PATCH', '/api/admin/orders/OS-999999', {'status': 'new'}, A); check('unknown order -> 404', s2 == 404, (s2, j2))
s2, j2, _, _ = req('PATCH', "/api/admin/orders/OS-1%27%20OR%201=1", {'status': 'new'}, A); check('odd order number never reaches the database', s2 == 404, (s2, j2))
s2, j2, _, _ = req('PATCH', f'/api/admin/orders/{first}', {'status': 'confirmed'}, {**A, 'Origin': 'https://evil.example'}); check('admin change from a foreign Origin refused', s2 == 403, (s2, j2))
s2, j2, _, _ = req('PATCH', f'/api/admin/orders/{first}', {'status': 'shipped', 'note': 'x' * 900}, A); check('status change accepted', s2 == 200, (s2, j2))
s, j, _, _ = req('GET', '/api/admin/orders?status=shipped', headers=A); check('note kept to 500 characters', any(o['id'] == first and len(o['note']) == 500 for o in j['orders']), s)
PNG = b'\x89PNG\r\n\x1a\n' + b'\0' * 64
s2, j2, _, _ = req('POST', '/api/admin/photo', raw=b'GIF89a' + b'0' * 50, headers={**A, 'Content-Type': 'image/png'}); check('GIF bytes labelled PNG refused', s2 == 400 and j2['error'] == 'not-an-image', (s2, j2))
s2, j2, _, _ = req('POST', '/api/admin/photo', raw=PNG, headers={**A, 'Content-Type': 'image/webp'}); check('PNG bytes labelled WebP refused', s2 == 400, (s2, j2))
s2, j2, _, _ = req('POST', '/api/admin/photo', raw=b'<svg onload=alert(1)>', headers={**A, 'Content-Type': 'image/svg+xml'}); check('SVG upload refused', s2 == 415, (s2, j2))
s2, j2, _, _ = req('POST', '/api/admin/photo', raw=PNG + b'0' * (1536 * 1024), headers={**A, 'Content-Type': 'image/png'}); check('photo over 1.5 MB refused', s2 == 413, (s2, j2))
s2, j2, _, _ = req('POST', '/api/admin/photo', raw=PNG, headers={**A, 'Content-Type': 'image/png'}); check('real PNG accepted', s2 == 201 and re.fullmatch(r'api/photo/[a-f0-9]{32}', j2['url']), (s2, j2))
s3, _, h3, _ = req('GET', '/' + j2['url']); check('photo served with its type, nosniff, no scripts', s3 == 200 and h3.get('Content-Type') == 'image/png' and h3.get('X-Content-Type-Options') == 'nosniff' and "default-src 'none'" in h3.get('Content-Security-Policy', ''), h3)
s, j, h, _ = req('GET', '/api/photo/' + 'f' * 32); check('unknown photo -> 404', s == 404, s)
s, j, h, t = req('GET', '/api/photo/../../etc/passwd'); check('odd photo path never reaches a file', s == 404 or 'root:' not in t, s)

# ---------- admin, signed out ----------
s, j, h, _ = req('GET', '/api/admin/orders'); check('admin orders without session -> 401', s == 401, s)
s, j, h, _ = req('PUT', '/api/admin/content', {'baseVersion': 0, 'content': {}}); check('admin publish without session -> 401', s == 401, s)
s, j, h, _ = req('GET', '/api/admin/orders', headers={'Cookie': 'onestyle_admin=' + 'a' * 64}); check('made-up session cookie -> 401', s == 401, s)
s, j, h, _ = req('GET', '/api/admin/orders', headers={'Cookie': 'onestyle_admin=../../x'}); check('malformed cookie -> 401', s == 401, s)
s, j, h, _ = req('POST', '/api/admin/photo', raw=PNG, headers={'Content-Type': 'image/png'}); check('photo upload without session -> 401', s == 401, s)
lip = {'CF-Connecting-IP': f'10.251.{random.randint(0, 255)}.{random.randint(1, 254)}'}
codes = [req('POST', '/api/admin/login', {'password': 'wrong-password-%d' % i}, lip)[0] for i in range(6)]
check('admin login locks after 5 failures from one IP', codes[:5] == [403] * 5 and codes[5] == 429, codes)
check('the owner signs in from another IP meanwhile', req('POST', '/api/admin/login', {'password': PASS})[0] == 200)
pip_ = {'CF-Connecting-IP': f'10.252.{random.randint(0, 255)}.{random.randint(1, 254)}'}; codes = []; lk = threading.Lock()
def bad_login():
    s, _, _, _ = req('POST', '/api/admin/login', {'password': 'nope-nope-nope'}, pip_)
    with lk: codes.append(s)
ts = [threading.Thread(target=bad_login) for _ in range(12)]; [t.start() for t in ts]; [t.join() for t in ts]
check('12 parallel wrong passwords from one IP: at most 5 checked', codes.count(403) <= 5 and codes.count(429) >= 7, sorted(codes))
s, j, h, _ = req('POST', '/api/admin/login', {'password': 'p' * 5000}); check('very long admin password answered quickly', s in (403, 413), s)
# admin reset: no address taken, only ADMIN_EMAIL
before = len(mails())
s, j, h, _ = req('POST', '/api/admin/forgot', {'email': 'attacker@example.test'}); time.sleep(1.5)
new = mails()[before:]
check('admin reset ignores any address sent and mails only ADMIN_EMAIL', s == 200 and new and all(m['body']['to'] == ['owner@example.test'] for m in new), (s, new))
link = re.search(r'#/admin-reset/([a-f0-9]{64})', new[-1]['body']['text']).group(1) if new else ''
s, j, h, _ = req('POST', '/api/admin/reset', {'token': link, 'password': 'short'}); check('admin reset with a weak password refused', s == 400 and j['error'] == 'weak-admin-password', (s, j))
s, j, h, _ = req('POST', '/api/admin/reset', {'token': 'a' * 64, 'password': 'onestyle-admin-pass-2030'}); check('made-up admin reset link refused', s == 400 and j['error'] == 'reset-expired', (s, j))
NEWPASS = 'Admin-2031'  # exactly 10 characters: the shortest the admin may use
s, j, h, _ = req('POST', '/api/admin/reset', {'token': link, 'password': NEWPASS}); A2 = {'Cookie': cookie(h)}
check('admin reset sets the new password and signs in', s == 200 and 'onestyle_admin=' in A2['Cookie'], (s, j))
check('older admin sessions end after the reset', req('GET', '/api/admin/orders', headers=A)[0] == 401)
check('the admin reset link works once only', req('POST', '/api/admin/reset', {'token': link, 'password': 'onestyle-admin-pass-2032'})[0] == 400)
check('old admin password no longer works', req('POST', '/api/admin/login', {'password': PASS})[0] == 403)
s, j, h, _ = req('POST', '/api/admin/password', {'current': 'wrong-wrong-wrong', 'password': 'onestyle-admin-pass-2033'}, A2); check('admin password change needs the current password', s == 403, (s, j))
s, j, h, _ = req('POST', '/api/admin/password', {'current': NEWPASS, 'password': 'onestyle-admin-pass-2033'}, A2); A3 = {'Cookie': cookie(h)}
check('admin password change returns a new session and ends the old one', s == 200 and req('GET', '/api/admin/orders', headers=A2)[0] == 401 and req('GET', '/api/admin/orders', headers=A3)[0] == 200, (s, j))
s, j, h, _ = req('POST', '/api/admin/logout', {}, A3); check('cookie stops working after sign out', s == 200 and req('GET', '/api/admin/orders', headers=A3)[0] == 401, s)
fip = {'CF-Connecting-IP': f'10.253.{random.randint(0, 255)}.{random.randint(1, 254)}'}
codes = [req('POST', '/api/admin/forgot', {}, {'CF-Connecting-IP': ip()})[0] for _ in range(3)]
check('admin reset emails capped at 3 an hour for the whole shop (1 sent above + 2)', codes == [200, 200, 429], codes)

# ---------- misc ----------
s, j, h, _ = req('GET', '/api/order'); check('GET on the order endpoint -> 404', s == 404, s)
s, j, h, t = req('GET', '/api/content'); check('API JSON escapes < and >', '<' not in t and '>' not in t, t[:80])
check('API responses are no-store and nosniff', h.get('X-Content-Type-Options') == 'nosniff' and 'no-' in h.get('Cache-Control', ''), h)
s, j, h, t = req('GET', '/devices/usb-c-charger-20-w/'); check('trailing slash redirects to one address', s == 301 and h.get('Location', '').endswith('/devices/usb-c-charger-20-w'), (s, h.get('Location')))
s, j, h, t = req('GET', '/ar/devices/usb-c-charger-20-w'); check('Arabic device page: lang=ar, rtl, hreflang', s == 200 and '<html lang="ar" dir="rtl">' in t and 'hreflang="en"' in t, s)
s, j, h, t = req('GET', '/account'); check('account page is never indexed', 'noindex,nofollow' in t, s)
s, j, h, t = req('GET', '/'); check('pages carry the security headers', "frame-ancestors 'none'" in h.get('Content-Security-Policy', '') and h.get('X-Frame-Options') in ('DENY', None), h.get('Content-Security-Policy'))
s, j, h, t = req('GET', '/devices/%3Cscript%3E'); check('script in a device address is not echoed', s == 404 and '<script>' not in t, s)
print(f"\n{sum(results)}/{len(results)} passed"); sys.exit(0 if all(results) else 1)
