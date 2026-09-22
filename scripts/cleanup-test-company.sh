#!/usr/bin/env bash
# VAKTO — hreinsa prufufyrirtæki af prod eftir Straumur-prófun.
# 1) Slekkur á korta-tokeninu hjá Straumi (live), 2) eyðir fyrirtækinu, eigandanum og diagnostic-viðburðum úr prod-grunninum.
# Keyrist úr ~/vakto-live:   bash scripts/cleanup-test-company.sh <company_id> [slóð á straumur-live.env]
set -euo pipefail
cd "$(dirname "$0")/.."

COMPANY="${1:-}"; ENVFILE="${2:-}"
[ -n "$COMPANY" ] || { echo "Notkun: bash scripts/cleanup-test-company.sh <company_id> [straumur-live.env]"; exit 1; }
TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)
PROD_REF="lsnthbnqcelfgeyuxgfn"
[ -n "$TOKEN" ] || { echo "Vantar SUPABASE_ACCESS_TOKEN í .env.local"; exit 1; }

# Keyrir SQL á prod og prentar JSON-svarið á stdout.
run_sql() {
  python3 - "$TOKEN" "$PROD_REF" "$1" <<'PY'
import sys, json, urllib.request
token, ref, sql = sys.argv[1], sys.argv[2], sys.argv[3]
req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{ref}/database/query",
  data=json.dumps({"query": sql}).encode(), method="POST",
  headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
try:
    with urllib.request.urlopen(req, timeout=180) as r: print(r.read().decode())
except urllib.error.HTTPError as e:
    print("VILLA", e.code, e.read().decode()[:400], file=sys.stderr); sys.exit(1)
PY
}

echo "== Fyrirtæki"
run_sql "select id,name,plan,card_required from companies where id='$COMPANY'"

echo "== Kort (tokens) á fyrirtækinu"
TOKENS=$(run_sql "select coalesce(string_agg(token, ' '), '') as t from payment_methods where company_id='$COMPANY'" \
  | python3 -c 'import sys,json; rows=json.load(sys.stdin); print(rows[0]["t"] if rows else "")')
echo "  $(echo "$TOKENS" | wc -w | tr -d ' ') token(ar)"

if [ -n "$TOKENS" ]; then
  if [ -z "$ENVFILE" ] || [ ! -f "$ENVFILE" ]; then
    echo "  Vantar straumur-live.env (2. breyta) til að slökkva á token hjá Straumi — sleppi því."
  else
    KEY=$(grep '^STRAUMUR_API_KEY=' "$ENVFILE" | cut -d= -f2-)
    BASE=$(grep '^STRAUMUR_BASE_URL=' "$ENVFILE" | cut -d= -f2-)
    for t in $TOKENS; do
      code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/payment/disable-token" \
        -H "X-API-Key: $KEY" -H "Content-Type: application/json" -d "{\"tokenValue\":\"$t\"}")
      echo "  disable-token ${t:0:6}… → HTTP $code"
    done
  fi
fi

echo "== Eyði úr prod-grunni (fyrirtæki + eigandi + diagnostic-viðburðir)"
run_sql "delete from billing_events where merchant_reference like 'test:%'"
run_sql "delete from auth.users where id in (select id from users where company_id='$COMPANY')"
run_sql "delete from companies where id='$COMPANY'"

echo "== Staðfesting (allt á að vera 0)"
run_sql "select (select count(*) from companies where id='$COMPANY') companies, (select count(*) from payment_methods where company_id='$COMPANY') cards, (select count(*) from billing_events where merchant_reference like 'test:%') diag"
