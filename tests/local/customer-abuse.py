"""Shopper account checks for One Style (customer.js), on a fresh local Worker: sh tests/local/run.sh python3 tests/local/customer-abuse.py.
   Sets up the admin and turns ordering on first.   python3 customer-abuse.py [port] [mail.jsonl]"""
import http.client, json, sys, random, secrets, threading, time, re, os
HOST, PORT = '127.0.0.1', int(sys.argv[1]) if len(sys.argv) > 1 else 8788
MAIL = sys.argv[2] if len(sys.argv) > 2 else os.environ.get('ONESTYLE_MAIL', '.wrangler/test-mail.jsonl')
ORIGIN = f'http://{HOST}:{PORT}'
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
def mails(): return [json.loads(l) for l in open(MAIL) if l.strip()] if os.path.exists(MAIL) else []

# setup + ordering on
s, j, h, _ = req('POST', '/api/admin/setup', {'code': 'test-setup-code-1234567890', 'password': 'onestyle-admin-pass-2026'}); ADM = {'Cookie': cookie(h)}
s, j, _, _ = req('GET', '/api/admin/content', headers=ADM); c = j['content']; c['settings']['checkout']['ordersOn'] = True
s, j, _, _ = req('PUT', '/api/admin/content', {'baseVersion': j['version'], 'content': c}, ADM); assert s == 200, (s, j)
charger = next(p for p in j['content']['catalog'] if p['id'] == 'usb-c-charger')['basePrice'] * 1000
def order(**over):
    o = {'token': secrets.token_hex(16), 'lines': [{'productId': 'usb-c-charger', 'color': 0, 'quantity': 1}], 'totalFils': charger, 'customer': {'name': 'Shopper', 'phone': '0791234567'}, 'fulfilment': 'pickup', 'lang': 'en', 'website': '', 'elapsedMs': 5000}
    o.update(over); return o

tag = secrets.token_hex(4)
ea, eb = f'alice.{tag}@example.test', f'bob.{tag}@example.test'
PA, PB = 'alice-long-password-1', 'bob-long-password-22'
for pw, err, label in [('abc1234', 'weak-password', '7-character password refused'), ('12345678', 'weak-password', 'digits-only password refused'), ('Password1', 'common-password', 'common password refused, whatever the case')]:
    s, j, h, _ = req('POST', '/api/customer/register', {'name': 'Alice', 'email': ea, 'password': pw}); check(label, s == 400 and j['error'] == err, (s, j))
s, j, h, _ = req('POST', '/api/customer/register', {'name': 'Carol', 'email': f'carol.{tag}@example.test', 'password': 'ahmad123'}); check('8 characters with letters accepted (ahmad123)', s == 201, (s, j))
s, j, h, _ = req('POST', '/api/customer/login', {'email': f'carol.{tag}@example.test', 'password': 'ahmad123'}); check('ahmad123 signs in', s == 200, (s, j))
s, j, h, _ = req('POST', '/api/customer/register', {'name': 'Alice', 'email': 'not-an-email', 'password': PA}); check('bad email refused', s == 400 and j['error'] == 'bad-email', (s, j))
s, j, h, _ = req('POST', '/api/customer/register', {'name': 'Alice', 'email': ea, 'password': PA, 'phone': '12345'}); check('bad mobile at sign-up refused', s == 400 and j['error'] == 'bad-phone', (s, j))
s, j, h, _ = req('POST', '/api/customer/register', {'name': 'Alice', 'email': ea, 'password': PA}, {'Origin': 'https://evil.example'}); check('register from a foreign Origin refused', s == 403, (s, j))
s, j, h, _ = req('POST', '/api/customer/register', {'name': '<script>x</script>', 'email': ea, 'password': PA}); check('name with < > refused', s == 400 and j['error'] == 'bad-name', (s, j))
s, j, h, _ = req('POST', '/api/customer/register', {'name': 'Alice "A" & co', 'email': ea.upper(), 'password': PA, 'phone': '+962 79 123 4567'})
A = {'Cookie': cookie(h)}; sc = h.get('Set-Cookie', '')
check('register sets an HttpOnly Secure SameSite=Strict cookie on /api', s == 201 and all(x in sc for x in ('HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/api;', 'onestyle_customer=')), (s, sc))
check('email stored in lower case, mobile normalised', j and j['customer']['email'] == ea and j['customer']['phone'] == '0791234567', j)
s, j, h, _ = req('POST', '/api/customer/register', {'name': 'Again', 'email': ea, 'password': PA}); check('same email twice refused', s == 409 and j['error'] == 'email-in-use', (s, j))
s, j, h, t = req('GET', '/api/customer/session', headers=A); check('session shows the shopper, quotes and & escaped in JSON', j['signedIn'] and '&' not in t and j['customer']['name'] == 'Alice "A" & co', t[:160])
s, j, h, _ = req('POST', '/api/customer/register', {'name': 'Bob', 'email': eb, 'password': PB}); B = {'Cookie': cookie(h)}
s, j, h, _ = req('GET', '/api/admin/orders', headers=A); check('shopper cookie cannot open the admin', s == 401, s)
s, j, h, _ = req('GET', '/api/admin/content', headers={'Cookie': 'onestyle_admin=' + A['Cookie'].split('=', 1)[1]}); check('shopper token used as admin cookie refused', s == 401, s)
s, j, h, _ = req('GET', '/api/customer/profile', headers=ADM); check('admin cookie does not open a shopper profile', s == 401, s)
s, j, h, _ = req('GET', '/api/customer/profile', headers={'Cookie': 'onestyle_customer=' + ADM['Cookie'].split('=', 1)[1]}); check('admin token used as shopper cookie refused', s == 401, s)
s, j, h, _ = req('GET', '/api/customer/profile', headers={'Cookie': 'onestyle_customer=' + 'a' * 64}); check('made-up shopper cookie refused', s == 401, s)
bob_id = req('GET', '/api/customer/profile', headers=B)[1]['customer']['id']
s, j, h, _ = req('POST', '/api/order', order(customer_id=bob_id, customerId=bob_id, owner=bob_id), A); na = j and j.get('number')
check('signed-in order placed', s == 201 and na, (s, j))
s, j, h, _ = req('POST', '/api/order', order(customer_id=bob_id, customerId=bob_id)); ng = j and j.get('number')
check('guest order placed (spoofed owner fields in the body)', s == 201 and ng, (s, j))
s, j, h, _ = req('GET', '/api/customer/orders', headers=A); mine = [o['id'] for o in j['orders']]
check('Alice sees her order, not the guest one', mine == [na], mine)
check('history carries no address or phone', all(set(o) <= {'id', 'date', 'status', 'fulfilment', 'shipping', 'total', 'items'} for o in j['orders']), j['orders'][:1])
s, j, h, _ = req('GET', '/api/customer/orders', headers=B); check('Bob sees nothing (spoofed owner ignored)', s == 200 and j['orders'] == [], j)
s, j, h, _ = req('GET', '/api/customer/orders?before=abc', headers=A); check('bad history cursor refused', s == 400, (s, j))
s, j, h, _ = req('GET', '/api/admin/orders', headers=ADM); acc = {o['id']: o['account'] for o in j['orders']}
check('admin sees both, marked account / guest', acc.get(na) == 'account' and acc.get(ng) == 'guest', acc)
s, j, h, _ = req('PATCH', '/api/customer/profile', {'phone': '12345'}, A); check('bad mobile on profile refused', s == 400 and j['error'] == 'bad-phone', (s, j))
s, j, h, _ = req('PATCH', '/api/customer/profile', {'name': 'Alice A', 'email': 'other@example.test'}, A); check('profile edit changes the name, never the email', s == 200 and j['customer']['name'] == 'Alice A' and j['customer']['email'] == ea, j)
s, j, h, _ = req('PATCH', '/api/customer/profile', {'name': 'X y'}, {**A, 'Origin': 'https://evil.example'}); check('profile edit from a foreign Origin refused', s == 403, s)
s, j, h, _ = req('POST', '/api/customer/login', {'email': 'nobody.' + tag + '@example.test', 'password': PA}); s2, j2, _, _ = req('POST', '/api/customer/login', {'email': ea, 'password': 'wrong-password-123'})
check('unknown email and wrong password give the same answer', s == s2 == 403 and j == j2, (s, j, s2, j2))
s, j, h, _ = req('POST', '/api/customer/login', {'email': ea, 'password': PA}); A2 = {'Cookie': cookie(h)}; check('right password signs in', s == 200, (s, j))
s, j, h, _ = req('POST', '/api/customer/password', {'current': 'wrong-password-123', 'password': 'alice-new-password-99'}, A); check('password change needs the current password', s == 403, (s, j))
s, j, h, _ = req('POST', '/api/customer/password', {'current': PA, 'password': 'alice-new-password-99'}, A); A3 = {'Cookie': cookie(h)}
check('password change works and returns a new session', s == 200 and A3['Cookie'] != A['Cookie'], (s, j))
check('old sessions stop working after a password change', req('GET', '/api/customer/profile', headers=A)[0] == 401 and req('GET', '/api/customer/profile', headers=A2)[0] == 401)
check('the new session works', req('GET', '/api/customer/profile', headers=A3)[0] == 200)
check('old password no longer signs in', req('POST', '/api/customer/login', {'email': ea, 'password': PA})[0] == 403)
s, j, h, _ = req('POST', '/api/customer/logout', {}, A3); check('sign out clears the cookie', s == 200 and 'Max-Age=0' in h.get('Set-Cookie', ''), h.get('Set-Cookie'))
check('session is dead after sign out', req('GET', '/api/customer/profile', headers=A3)[0] == 401)

# ---------- reset by email ----------
before = len(mails())
s1, j1, _, _ = req('POST', '/api/customer/forgot', {'email': eb}); s2, j2, _, _ = req('POST', '/api/customer/forgot', {'email': 'nobody.' + tag + '@example.test'})
check('forgot: same answer for a real and an unknown email', s1 == s2 == 200 and j1 == j2, (s1, j1, s2, j2))
time.sleep(1.5); new = mails()[before:]
check('only the real account gets an email', [m['body']['to'] for m in new] == [[eb]], [m['body']['to'] for m in new])
token = re.search(r'#/reset/([a-f0-9]{64})', new[0]['body']['text']).group(1) if new else ''
check('reset link carries the token after #, so it never reaches server logs', bool(token) and f'#/reset/{token}' in new[0]['body']['text'] and f'/reset/{token}' not in new[0]['body']['text'].replace(f'#/reset/{token}', ''), new[:1])
check('email says the link works 30 minutes, holds no typed text', '30' in new[0]['body']['text'], new[0]['body']['text'][:200] if new else '')
s, j, _, _ = req('POST', '/api/customer/reset', {'token': token, 'password': 'short'}); check('reset with a weak password refused (link still good)', s == 400 and j['error'] == 'weak-password', (s, j))
s, j, _, _ = req('POST', '/api/customer/reset', {'token': 'b' * 64, 'password': 'bob-new-password-333'}); check('made-up reset token refused', s == 400 and j['error'] == 'reset-expired', (s, j))
# someone else asking for more links must not erase the one already sent to Alice
before_a = len(mails()); req('POST', '/api/customer/forgot', {'email': ea}); time.sleep(1.2); req('POST', '/api/customer/forgot', {'email': ea}); time.sleep(1.5)
alice_links = [re.search(r'#/reset/([a-f0-9]{64})', m['body']['text']).group(1) for m in mails()[before_a:] if m['body']['to'] == [ea]]
s, j, _, _ = req('POST', '/api/customer/reset', {'token': alice_links[0] if alice_links else '', 'password': 'alice-new-password-99'})
check('an earlier link still works after a later request', len(alice_links) == 2 and s == 200, (len(alice_links), s, j))
check('using one link ends the other', req('POST', '/api/customer/reset', {'token': alice_links[-1] if alice_links else '', 'password': 'alice-new-password-99'})[0] == 400)
s, j, h, _ = req('POST', '/api/customer/reset', {'token': token, 'password': 'bob-new-password-333'}); B2 = {'Cookie': cookie(h)}
check('reset sets the new password and signs in', s == 200 and req('GET', '/api/customer/profile', headers=B2)[0] == 200, (s, j))
check('older sessions end after the reset', req('GET', '/api/customer/profile', headers=B)[0] == 401)
check('the reset link works once only', req('POST', '/api/customer/reset', {'token': token, 'password': 'bob-new-password-444'})[0] == 400)
check('new password signs in, old one does not', req('POST', '/api/customer/login', {'email': eb, 'password': 'bob-new-password-333'})[0] == 200 and req('POST', '/api/customer/login', {'email': eb, 'password': PB})[0] == 403)
# a reset link dies when the password changes another way
before = len(mails()); req('POST', '/api/customer/forgot', {'email': eb}); time.sleep(1.5)
t2 = re.search(r'#/reset/([a-f0-9]{64})', mails()[before]['body']['text']).group(1)
s, j, h, _ = req('POST', '/api/customer/login', {'email': eb, 'password': 'bob-new-password-333'}); B3 = {'Cookie': cookie(h)}
req('POST', '/api/customer/password', {'current': 'bob-new-password-333', 'password': 'bob-new-password-555'}, B3)
check('an open reset link stops working after a sign-in or password change', req('POST', '/api/customer/reset', {'token': t2, 'password': 'bob-new-password-666'})[0] == 400)
# per-account cap: 3 emails an hour (2 used above)
before = len(mails())
for _ in range(3): req('POST', '/api/customer/forgot', {'email': eb})
time.sleep(1.5); check('reset emails per account capped at 3 an hour', len([m for m in mails()[before:] if m['body']['to'] == [eb]]) == 1, len(mails()) - before)
rip = {'CF-Connecting-IP': f'10.243.{random.randint(0, 255)}.{random.randint(1, 254)}'}
codes = [req('POST', '/api/customer/forgot', {'email': f'x{i}.{tag}@example.test'}, rip)[0] for i in range(6)]
check('6th reset request from one IP in an hour is rate-limited', codes[:5] == [200] * 5 and codes[5] == 429, codes)
tip = {'CF-Connecting-IP': f'10.244.{random.randint(0, 255)}.{random.randint(1, 254)}'}
codes = [req('POST', '/api/customer/reset', {'token': secrets.token_hex(32), 'password': 'guess-guess-guess-1'}, tip)[0] for _ in range(11)]
check('reset-link guessing locks after 10 tries from one IP', codes[:10] == [400] * 10 and codes[10] == 429, codes)

# ---------- limits ----------
lip = {'CF-Connecting-IP': f'10.240.{random.randint(0, 255)}.{random.randint(1, 254)}'}
codes = [req('POST', '/api/customer/login', {'email': ea, 'password': f'wrong-password-{i:03}'}, lip)[0] for i in range(11)]
check('shopper login locks after 10 tries from one IP', codes[:10] == [403] * 10 and codes[10] == 429, codes)
pip_ = {'CF-Connecting-IP': f'10.241.{random.randint(0, 255)}.{random.randint(1, 254)}'}; codes = []; lk = threading.Lock()
def bad():
    s = req('POST', '/api/customer/login', {'email': ea, 'password': 'wrong-password-xyz'}, pip_)[0]
    with lk: codes.append(s)
ts = [threading.Thread(target=bad) for _ in range(20)]; [t.start() for t in ts]; [t.join() for t in ts]
check('20 parallel wrong logins from one IP: at most 10 checked', codes.count(403) <= 10 and codes.count(429) >= 10, sorted(codes))
s, j, h, _ = req('POST', '/api/customer/login', {'email': ea, 'password': 'alice-new-password-99'}); A4 = {'Cookie': cookie(h)}
check('the shopper still signs in from another IP', s == 200, s)
gip = {'CF-Connecting-IP': f'10.242.{random.randint(0, 255)}.{random.randint(1, 254)}'}
codes = [req('POST', '/api/customer/register', {'name': 'Spam', 'email': f'spam{i}.{tag}@example.test', 'password': 'spam-long-password-1'}, gip)[0] for i in range(6)]
check('6th sign-up from one IP in an hour is rate-limited', codes[:5] == [201] * 5 and codes[5] == 429, codes)
s, j, h, _ = req('POST', '/api/customer/login', raw=b'x' * 9000); check('oversized login body refused', s == 413, s)
s, j, h, _ = req('POST', '/api/customer/login', {'email': ea, 'password': 'p' * 5000}); check('very long password answered without hashing it', s in (403, 413, 429), s)
s, j, h, _ = req('GET', '/api/customer/nope', headers=A4); check('unknown shopper path -> 404', s == 404, s)
s, j, h, _ = req('GET', '/api/customer/orders'); check('history without a session -> 401', s == 401, s)
print(f"\n{sum(results)}/{len(results)} passed"); sys.exit(0 if all(results) else 1)
