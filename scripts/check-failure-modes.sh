#!/bin/sh
# Stops parts of the running E2E stack and checks what visitors get. Run from the repository root after
# starting the stack as described in compose.e2e.yaml. Exits non-zero on the first wrong answer.
set -u

COMPOSE="docker compose --env-file e2e/e2e.env -f compose.yaml -f compose.e2e.yaml -p portfolio-e2e"
BASE="${E2E_BASE_URL:-http://localhost:8088}"
failed=0

check() {
  description="$1"
  path="$2"
  expected_status="$3"
  expected_text="$4"
  body="$(mktemp)"
  status="$(curl -s -o "$body" -w '%{http_code}' "$BASE$path")"
  if [ "$status" = "$expected_status" ] && grep -q "$expected_text" "$body"; then
    echo "ok: $description ($status)"
  else
    echo "FAILED: $description. Expected $expected_status with '$expected_text', got $status"
    failed=1
  fi
  rm -f "$body"
}

$COMPOSE stop backend >/dev/null 2>&1
check "page with the backend down" /en 503 "temporarily unavailable"
check "Polish text on the same page" /pl 503 "chwilowo"
check "privacy page with the backend down" /en/privacy 503 "temporarily unavailable"
check "API with the backend down" /api/public/content/en 503 "temporarily unavailable"
$COMPOSE start backend >/dev/null 2>&1
$COMPOSE up -d --wait backend >/dev/null 2>&1

$COMPOSE stop frontend >/dev/null 2>&1
check "page with the frontend down" /en 503 "temporarily unavailable"
check "API still works with the frontend down" /api/public/content/en 200 "fullName"
$COMPOSE start frontend >/dev/null 2>&1

sleep 3
check "page after both are back" /en 200 "Test Person"

exit "$failed"
