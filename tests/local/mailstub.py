"""Stand-in for the Resend API: records every request as one JSON line."""
import http.server, json, sys, time
LOG = sys.argv[2] if len(sys.argv) > 2 else '.wrangler/test-mail.jsonl'
TELEGRAM = []
MODE = {}
class H(http.server.BaseHTTPRequestHandler):
    def answer(self, status, data):
        self.send_response(status); self.send_header('Content-Type', 'application/json'); self.end_headers()
        try: self.wfile.write(json.dumps(data).encode())
        except (BrokenPipeError, ConnectionResetError): pass
    def do_GET(self):
        if self.path == '/telegram-log': self.answer(200, TELEGRAM)
        else: self.answer(404, {})
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get('Content-Length') or 0))
        if self.path == '/telegram-control':
            MODE.clear(); MODE.update(json.loads(body or b'{}')); self.answer(200, {}); return
        if self.path.startswith('/telegram/bot'):
            method = self.path.rsplit('/', 1)[-1]
            data = json.loads(body or b'{}')
            TELEGRAM.append({'method': method, 'body': data})  # Never record the token-bearing URL.
            if MODE.get('delay') and method == 'sendMessage': time.sleep(MODE['delay'])
            status = MODE.get('status', 200) if method == 'sendMessage' else 200
            if '/bot00000:' in self.path: status = 401
            if str(data.get('chat_id')) == '99999': status = 400
            if MODE.get('updatesBusy') and method == 'getUpdates': status = 409
            if status != 200: self.answer(status, {'ok': False, 'error_code': status, 'description': 'stub rejection'}); return
            result = {'getMe': {'id': 123456789, 'is_bot': True, 'username': 'onestyle_test_bot'}, 'getChat': {'id': -1001234567890, 'type': 'supergroup'}, 'sendMessage': {'message_id': len(TELEGRAM)}, 'getUpdates': []}.get(method)
            if method == 'getUpdates' and not MODE.get('empty'):
                result = [{'message': {'chat': {'id': 123456789, 'first_name': 'Test <Chat>', 'type': 'private'}}}, {'message': {'chat': {'id': -1001234567890, 'title': 'Shop team', 'type': 'supergroup'}}}]
            self.answer(200, {'ok': True, 'result': result}); return
        with open(LOG, 'a') as f: f.write(json.dumps({'path': self.path, 'auth': self.headers.get('Authorization'), 'idem': self.headers.get('Idempotency-Key'), 'body': json.loads(body or b'{}')}) + '\n')
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(b'{"id":"stub"}')
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
