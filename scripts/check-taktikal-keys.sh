#!/usr/bin/env bash
# Prófar Taktikal-lyklana á Vercel Production gegn bæði production- og DEV-gátt Taktikal.
# Prentar AÐEINS svarkóða og lengd lyklanna — aldrei gildin. Keyrsla: bash scripts/check-taktikal-keys.sh
set -euo pipefail
cd "$(dirname "$0")/.."
TMP=$(mktemp); trap 'rm -f "$TMP"' EXIT
umask 077
vercel env pull "$TMP" --environment production --yes >/dev/null 2>&1
set -a; . "$TMP"; set +a
for host in onboarding onboardingdev; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -u "${TAKTIKAL_COMPANY_KEY}:${TAKTIKAL_API_KEY}" "https://$host.taktikal.is/api/management/flow")
  echo "$host.taktikal.is → $code"
done
echo "lengd: company_key=${#TAKTIKAL_COMPANY_KEY} api_key=${#TAKTIKAL_API_KEY} flow_key=${#TAKTIKAL_FLOW_KEY} base_url=${TAKTIKAL_BASE_URL:-ekki sett (production)}"
