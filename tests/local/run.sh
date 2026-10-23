#!/bin/sh
# Local test run: a fresh local database, the rebuilt site, the Worker on :8788 with the test
# values in tests/local/test.env, and an email stand-in on :8799. Then one test command.
#   sh tests/local/run.sh python3 tests/local/api-abuse.py
#   sh tests/local/run.sh python3 tests/local/customer-abuse.py
#   sh tests/local/run.sh node tests/local/e2e.mjs        (needs Playwright)
#   sh tests/local/run.sh node tests/local/sweep.mjs      (needs Playwright)
set -e
cd "$(dirname "$0")/../.."
if [ -f .dev.vars ] || [ -f .env ]; then echo "Move .dev.vars / .env aside first: local tests use tests/local/test.env only." >&2; exit 2; fi
STATE=.wrangler/test-state
export ONESTYLE_MAIL=.wrangler/test-mail.jsonl ONESTYLE_OUT=.wrangler
rm -rf "$STATE"; mkdir -p "$STATE"; : > "$ONESTYLE_MAIL"
node tools/build.mjs > /dev/null
# Keep development filesystem notifications on freshly copied dist files from restarting
# the Worker during a slow network test. The served snapshot has the same built bytes.
ASSETS_DIR=$(mktemp -d "${TMPDIR:-/tmp}/onestyle-test-assets.XXXXXX")
cp -R dist/. "$ASSETS_DIR/"
npx wrangler d1 migrations apply DB --local --persist-to "$STATE" > /dev/null 2>&1
python3 tests/local/mailstub.py 8799 "$ONESTYLE_MAIL" &
MAILER=$!
npx wrangler dev --port 8788 --ip 127.0.0.1 --persist-to "$STATE" --env-file tests/local/test.env --assets "$ASSETS_DIR" > .wrangler/test-dev.log 2>&1 &
WORKER=$!
# Stops each process with everything it started (npx -> wrangler -> workerd), on macOS and Linux:
# the whole tree is listed first, so wrangler can't start a new workerd in between.
tree() { echo "$1"; for child in $(pgrep -P "$1" 2>/dev/null); do tree "$child"; done; }
stop() { pids="$(tree "$WORKER") $(tree "$MAILER")"; kill $pids 2>/dev/null; sleep 1; kill -9 $pids 2>/dev/null; rm -rf "$ASSETS_DIR"; true; }
trap stop EXIT INT TERM
i=0; until curl -s -o /dev/null http://127.0.0.1:8788/api/content; do i=$((i+1)); [ $i -gt 60 ] && { echo "The local Worker did not start; see .wrangler/test-dev.log" >&2; exit 1; }; sleep 1; done
set +e
"$@"
