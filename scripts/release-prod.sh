#!/usr/bin/env bash
# VAKTO — release live-fixes → main + migrations 0044–0048 á prod-grunninn.
# Keyrist úr ~/vakto-live:   bash scripts/release-prod.sh
# Röð: 1) migrations á prod (kóðinn gerir ráð fyrir dálkunum), 2) push á main → Vercel deploy.
set -euo pipefail
cd "$(dirname "$0")/.."

TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)
PROD_REF="lsnthbnqcelfgeyuxgfn"
[ -n "$TOKEN" ] || { echo "Vantar SUPABASE_ACCESS_TOKEN í .env.local"; exit 1; }

run_sql() {
  python3 - "$TOKEN" "$PROD_REF" "$1" <<'EOF'
import sys, json, urllib.request
token, ref, sql = sys.argv[1], sys.argv[2], sys.argv[3]
req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{ref}/database/query",
  data=json.dumps({"query": sql}).encode(), method="POST",
  headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
try:
    with urllib.request.urlopen(req, timeout=180) as r: print("  ok", r.status, r.read().decode()[:200])
except urllib.error.HTTPError as e:
    print("  VILLA", e.code, e.read().decode()[:400]); sys.exit(1)
EOF
}

echo "== Prod-grunnur: staða fyrir"
run_sql "select (select count(*) from companies) companies, (select count(*) from employees) employees"

for f in 0044_security.sql 0045_labor_target.sql 0046_chat_messenger.sql 0047_platform_admin.sql 0048_comment_replies.sql; do
  echo "== $f"
  run_sql "$(cat supabase/migrations/$f)"
done

echo "== Staðfesting"
run_sql "select (select count(*) filter (where kiosk_token ~ '^[a-f0-9]{32}$') from companies) kiosk_ok, (select count(*) from companies where labor_target is not null) target_ok, to_regclass('public.channel_reads') reads, to_regclass('public.platform_audit') pa, (select count(*) from information_schema.columns where table_name='post_comments' and column_name='parent_id') parent"

echo "== Push live-fixes → main"
git push origin live-fixes:main
echo "Búið. Vercel byggir main núna; athugaðu https://www.vakto.is eftir 1–2 mín."
