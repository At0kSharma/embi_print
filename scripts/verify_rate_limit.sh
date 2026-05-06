#!/usr/bin/env bash
# Verify the /uploads rate limit (10/minute/IP) is enforced. Run against
# any environment that has a real S3 backend wired up (the upload won't
# actually persist if S3 isn't configured — the rate limiter runs first).
#
# Usage: ./scripts/verify_rate_limit.sh https://api.your-domain.com
set -euo pipefail

BASE=${1:-http://localhost:8000}

# 1×1 transparent PNG, base64-encoded
PNG_B64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
TMP=$(mktemp --suffix=.png)
trap 'rm -f "$TMP"' EXIT
echo "$PNG_B64" | base64 -d > "$TMP"

ok=0
limited=0
for i in $(seq 1 11); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -F "file=@${TMP};type=image/png" "$BASE/uploads/")
  echo "  request $i → HTTP $code"
  if [ "$code" = "201" ]; then ok=$((ok + 1)); fi
  if [ "$code" = "429" ]; then limited=$((limited + 1)); fi
done

echo
echo "201 responses: $ok"
echo "429 responses: $limited"

if [ "$ok" -ge 10 ] && [ "$limited" -ge 1 ]; then
  echo "PASS: rate limit is active"
  exit 0
else
  echo "FAIL: expected ≥10 successes and ≥1 rate-limited; got $ok / $limited"
  exit 1
fi
