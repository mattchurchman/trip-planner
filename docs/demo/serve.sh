#!/usr/bin/env bash
# Serves a signed-in copy of the app with sample data, for checking layouts.
# Usage: bash docs/demo/serve.sh [port]   (default 8001)
# Then open http://localhost:8001/#/trip/t1/overview  (add ?signedout for the sign-in card)
# The copy lives in a temp folder; your repo is never changed.
set -euo pipefail
PORT="${1:-8001}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$(mktemp -d)"
tar -C "$ROOT" --exclude=.git -cf - . | tar -C "$OUT" -xf -
cp "$ROOT/docs/demo/firebase-stub.js" "$OUT/js/firebase.js"
cp "$ROOT/docs/demo/demo-seed.js" "$OUT/js/demo-seed.js"
echo "Demo copy at $OUT — serving on http://localhost:$PORT"
cd "$OUT" && exec python3 -m http.server "$PORT"
