#!/bin/sh
# The GitHub Pages preview, served from the project folder on 127.0.0.1:8813 (http, like Pages'
# https: both allow the browser's password hashing), then its demo accounts test.
set -e
cd "$(dirname "$0")/../.."
mkdir -p .wrangler
python3 -m http.server 8813 --bind 127.0.0.1 > .wrangler/preview-server.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT INT TERM
i=0; until curl -s -o /dev/null http://127.0.0.1:8813/index.html; do i=$((i+1)); [ $i -gt 30 ] && { echo "The preview server did not start" >&2; exit 1; }; sleep 1; done
node tests/preview/accounts.mjs http://127.0.0.1:8813/ .wrangler
