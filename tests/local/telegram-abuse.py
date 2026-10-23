"""Telegram integration against a fresh local Worker and the local HTTP stand-in only."""
import http.client, json, random, secrets, time, sys, itertools, concurrent.futures

ORIGIN = 'http://127.0.0.1:8788'
TOKEN = '123456789:' + 'x' * 35  # Deliberately fake; the local stand-in never contacts Telegram.
CHAT = '-1001234567890'
checks = []
connections = []
def request(method, path, body=None, cookie='', origin=ORIGIN, raw=None, content_type='application/json', port=8788):
    c = http.client.HTTPConnection('127.0.0.1', port, timeout=30)
    headers = {'Origin': origin, 'Content-Type': content_type, 'CF-Connecting-IP': f'10.87.{random.randrange(255)}.{random.randrange(1,255)}'}
    if cookie: headers['Cookie'] = cookie
    c.request(method, path, raw if raw is not None else json.dumps(body).encode() if body is not None else None, headers)
    res = c.getresponse(); text = res.read().decode(); headers = dict(res.getheaders()); status = res.status
    # Keep the order connection alive while the local proxy runs waitUntil (as browsers do).
    if path == '/api/order': connections.append(c)
    else: c.close()
    try: data = json.loads(text)
    except ValueError: data = None
    return status, data, headers, text
def check(label, condition):
    checks.append(bool(condition)); print(('PASS ' if condition else 'FAIL ') + label, flush=True)
def stub(body): request('POST', '/telegram-control', body, port=8799)
def messages(): return request('GET', '/telegram-log', port=8799)[1]
def sent(): return [entry for entry in messages() if entry['method'] == 'sendMessage']
def wait_for(fn, timeout=3):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if fn(): return True
        time.sleep(.04)
    return False

for method, path in [('GET','telegram'),('PUT','telegram'),('DELETE','telegram'),('POST','telegram/chats'),('POST','telegram/test')]:
    check(f'{method} {path} requires the admin session', request(method, '/api/admin/' + path, {})[0] == 401)
s, _, h, _ = request('POST', '/api/admin/setup', {'code':'test-setup-code-1234567890','password':'onestyle-admin-pass-2026'})
admin = h.get('Set-Cookie','').split(';')[0]
check('local admin setup succeeds', s == 200 and admin.startswith('onestyle_admin='))
meta = lambda: request('GET','/api/admin/telegram',cookie=admin)[1]
def save(token=TOKEN, chat=CHAT, enabled=True, version=None):
    return request('PUT','/api/admin/telegram',{'token':token,'chatId':chat,'enabled':enabled,'baseVersion':meta()['version'] if version is None else version},admin)
check('new connection is off and has no token in its response', meta() == {'configured':False,'enabled':False,'chatId':'','botUsername':'','version':'','lastResult':'','lastAttemptAt':''})
check('foreign-origin save is refused', request('PUT','/api/admin/telegram',{},admin,'https://foreign.example')[0] == 403)
check('wrong content type is refused', request('PUT','/api/admin/telegram',{},admin,content_type='text/plain')[0] == 415)
check('oversized settings body is refused', request('PUT','/api/admin/telegram',None,admin,raw=b'"'+b'x'*3000+b'"')[0] == 413)
check('malformed JSON is refused', request('PUT','/api/admin/telegram',None,admin,raw=b'{')[0] == 400)
check('missing token is refused', save(token='')[1]['error'] == 'telegram-token')
check('a URL cannot be used as a bot token', save(token='https://foreign.example/steal')[1]['error'] == 'telegram-token')
s, data, _, text = save(token='00000:'+'x'*35)
check('upstream token rejection is redacted', s == 502 and data['error'] == 'telegram-token' and '00000:' not in text and 'stub rejection' not in text)
s, data, _, _ = request('POST','/api/admin/telegram/chats',{'token':TOKEN},admin)
check('chat lookup returns distinct private/group choices', s == 200 and {c['id'] for c in data['chats']} == {'123456789',CHAT})
lookup = next(e for e in messages() if e['method'] == 'getUpdates')
check('chat lookup does not consume updates or change subscriptions', set(lookup['body']) == {'limit','timeout'})
stub({'updatesBusy':True})
check('existing bot webhook is left alone and reported', request('POST','/api/admin/telegram/chats',{'token':TOKEN},admin)[1]['error'] == 'telegram-updates-busy')
stub({'empty':True})
check('an empty chat lookup is safe to retry', request('POST','/api/admin/telegram/chats',{'token':TOKEN},admin)[1] == {'chats':[]})
stub({})
check('an invalid chat is refused before saving', save(chat='99999')[1]['error'] == 'telegram-chat' and not meta()['configured'])
s, d, _, text = save()
check('valid bot and group can be saved and enabled', s == 200 and d['configured'] and d['enabled'] and d['chatId'] == CHAT and d['botUsername'] == 'onestyle_test_bot')
check('save response contains only redacted metadata', TOKEN not in text and 'token' not in d)
previous = d['version']
check('stale saves are refused', save(version='')[0] == 409)
s, d, _, text = save(token='')
check('blank token keeps the existing private token', s == 200 and d['enabled'] and d['version'] != previous and TOKEN not in text)
for path in ['/api/content','/api/admin/content','/','/ar','/index.html']:
    response = request('GET', path, cookie=admin)
    check(f'token never appears in {path}', response[0] in (200,301,302,307,308) and TOKEN not in response[3] and 'telegram_settings' not in response[3])
check('Telegram metadata is never cacheable', request('GET','/api/admin/telegram',cookie=admin)[2].get('Cache-Control') == 'no-store')
s, _, h, _ = request('POST','/api/customer/register',{'name':'Test customer','email':'telegram-test@example.test','password':'my-test-pass-2026','phone':''})
customer = h.get('Set-Cookie','').split(';')[0]
check('shopper cookie cannot read or change the Telegram connection', s == 201 and request('GET','/api/admin/telegram',cookie=customer)[0] == 401 and request('PUT','/api/admin/telegram',{},customer)[0] == 401)
check('test message is delivered to the saved chat', request('POST','/api/admin/telegram/test',{},admin)[1]['lastResult'] == 'sent' and sent()[-1]['body']['chat_id'] == CHAT)

# Publish the local catalogue and place real API orders with the admin browser uninvolved.
_, published, _, _ = request('GET','/api/admin/content',cookie=admin)
content = published['content']; content['settings']['checkout']['ordersOn'] = True
check('local ordering can be enabled', request('PUT','/api/admin/content',{'baseVersion':published['version'],'content':content},admin)[0] == 200)
def price(product, ram=None, storage=None):
    start = product['offerPrice'] if isinstance(product.get('offerPrice'),(int,float)) and 0 < product['offerPrice'] < product['basePrice'] else product['basePrice']
    return round((start + ((ram-product['ramOptions'][0])*9 if product.get('ramOptions') else 0) + (product['storageOptions'].index(storage)*75 if product.get('storageOptions') else 0))*1000)
charger = next(p for p in content['catalog'] if p['id'] == 'usb-c-charger')
def order(lines=None, total=None):
    return {'token':secrets.token_hex(16),'lines':lines or [{'productId':charger['id'],'color':0,'ram':None,'storage':None,'quantity':1}], 'totalFils':price(charger) if total is None else total, 'customer':{'name':'Private customer name','phone':'0791234567','city':'Amman','address':'PRIVATE DELIVERY ADDRESS','notes':'PRIVATE NOTES'},'fulfilment':'delivery','lang':'en','website':'','elapsedMs':5000}
before = len(sent()); payload = order(); s, result, _, _ = request('POST','/api/order',payload)
check('a new order succeeds independently of notification delivery', s == 201 and result['number'].startswith('OS-'))
check('a saved order produces a server-side Telegram alert', wait_for(lambda:len(sent()) == before+1))
message = sent()[-1]['body']; text = message['text']
check('alert has order number, total and admin link', result['number'] in text and 'Total:' in text and '/#/admin/order/' in text)
check('customer details and tokens stay out of Telegram messages', all(value not in text for value in ['Private customer name','0791234567','PRIVATE DELIVERY ADDRESS','PRIVATE NOTES',TOKEN]) and 'parse_mode' not in message)
check('a retried order returns the same number', request('POST','/api/order',payload)[1]['number'] == result['number'])
time.sleep(.15)
check('a retried order never sends a second alert', len(sent()) == before+1)
before = len(sent()); parallel_order = order()
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    parallel = list(pool.map(lambda _:request('POST','/api/order',parallel_order),range(2)))
check('concurrent retries create one order and one alert', all(r[0] in (200,201) for r in parallel) and parallel[0][1]['number'] == parallel[1][1]['number'] and wait_for(lambda:len(sent()) == before+1))

# Valid maximum-size order: long product descriptions cannot remove the footer.
long_content = json.loads(json.dumps(content))
for p in long_content['catalog']: p['name'] = 'Long device name ' + 'A'*220
_, latest, _, _ = request('GET','/api/admin/content',cookie=admin)
s, published_long, _, _ = request('PUT','/api/admin/content',{'baseVersion':latest['version'],'content':long_content},admin)
check('long valid product names can be published', s == 200)
lines = []; total = 0
for p in published_long['content']['catalog']:
    for color, ram, storage in itertools.product(range(len(p['colors'])),p.get('ramOptions') or [None],p.get('storageOptions') or [None]):
        if len(lines) == 20: break
        lines.append({'productId':p['id'],'color':color,'ram':ram,'storage':storage,'quantity':1}); total += price(p,ram,storage)
    if len(lines) == 20: break
before = len(sent()); s, result, _, _ = request('POST','/api/order',order(lines,total))
check('maximum twenty-line order is accepted', len(lines) == 20 and s == 201)
wait_for(lambda:len(sent()) == before+1)
text = sent()[-1]['body']['text']
check('oversized item details retain the total and admin link within Telegram limit', len(text) <= 3900 and 'Total:' in text and '/#/admin/order/'+result['number'] in text and 'Full details in admin' in text)

stub({'status':403}); before = len(sent()); s, result, _, _ = request('POST','/api/order',order())
check('Telegram rejection never rejects an already saved order', s == 201 and wait_for(lambda:meta()['lastResult'] == 'telegram-blocked'))
check('notification rejection is visible to admin without leaking its token', TOKEN not in json.dumps(meta()) and meta()['lastResult'] == 'telegram-blocked')
before_calls = len(messages()); s, d, _, _ = save(token='',enabled=False)
check('alerts can be turned off while Telegram is unavailable', s == 200 and not d['enabled'] and len(messages()) == before_calls)
before = len(sent()); request('POST','/api/order',order()); time.sleep(.15)
check('disabled alerts do not send order messages', len(sent()) == before)
stub({}); check('saved credentials can re-enable alerts', save(token='')[0] == 200)
stub({'delay':8}); started = time.monotonic(); s, _, _, _ = request('POST','/api/order',order())
check('slow Telegram never delays order confirmation', s == 201 and time.monotonic()-started < 1)
# The send path is shared by orders and this action. Check its deadline in an active
# request so a local development reload cannot silently cancel background work.
started = time.monotonic(); s, result, _, _ = request('POST','/api/admin/telegram/test',{},admin)
if s == 503 and result is None:
    # Wrangler can reload once after initial filesystem notifications; its raw 503 is
    # distinct from every application response. Retry only that transport interruption.
    started = time.monotonic(); s, result, _, _ = request('POST','/api/admin/telegram/test',{},admin)
elapsed = time.monotonic()-started
timeout_meta = meta()
bounded = s == 502 and result.get('error') == 'telegram-unavailable' and elapsed < 7.5 and timeout_meta['lastResult'] == 'telegram-unavailable'
check('a hung test send is bounded and records its failure', bounded)
stub({})
old_version = meta()['version']; s, d, _, _ = request('DELETE','/api/admin/telegram',{'baseVersion':old_version},admin)
check('removing a connection removes stored credentials', s == 200 and not d['configured'] and not d['enabled'])
check('reconnecting gets a fresh revision', save()[0] == 200 and meta()['version'] != old_version)
check('stale delete cannot remove a new connection', request('DELETE','/api/admin/telegram',{'baseVersion':old_version},admin)[0] == 409 and meta()['configured'])
request('DELETE','/api/admin/telegram',{'baseVersion':meta()['version']},admin)
check('test before configuration is refused', request('POST','/api/admin/telegram/test',{},admin)[1]['error'] == 'telegram-not-configured')
limited = False
for _ in range(41):
    if request('POST','/api/admin/telegram/test',{},admin)[0] == 429: limited = True; break
check('integration operations have a shared rate limit', limited)
for connection in connections: connection.close()
print(f'\n{sum(checks)}/{len(checks)} Telegram checks passed',flush=True)
sys.exit(0 if all(checks) else 1)
