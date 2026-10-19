"""Stand-in for the Resend API: records every request as one JSON line."""
import http.server, json, sys
LOG = sys.argv[2] if len(sys.argv) > 2 else '.wrangler/test-mail.jsonl'
class H(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get('Content-Length') or 0))
        with open(LOG, 'a') as f: f.write(json.dumps({'path': self.path, 'auth': self.headers.get('Authorization'), 'idem': self.headers.get('Idempotency-Key'), 'body': json.loads(body or b'{}')}) + '\n')
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(b'{"id":"stub"}')
    def log_message(self, *a): pass
http.server.HTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
