#!/bin/sh
resp=$(curl -s -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{"username":"syamsudin","password":"owner"}')
token=$(printf "%s" "$resp" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
post() {
  path="$1"
  body="$2"
  code=$(curl -s -o /tmp/out.$$ -w "%{http_code}" -X POST "http://localhost:3000/data/$path" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "$body")
  echo "POST $path -> $code"
  head -c 220 /tmp/out.$$; echo
}
del() {
  path="$1"
  id="$2"
  code=$(curl -s -o /tmp/out.$$ -w "%{http_code}" -X DELETE "http://localhost:3000/data/$path/$id" -H "Authorization: Bearer $token")
  echo "DELETE $path/$id -> $code"
  head -c 160 /tmp/out.$$; echo
}
post working-expense-sheets '{"entityId":"WES-TEMP-001","payload":{"id":"WES-TEMP-001","client":"Temp Client","project":"Temp Project","location":"Jakarta","date":"2026-03-11","noHal":"TEMP/WES/001","revisi":"0","totalKas":10000,"status":"Draft","items":[]}}'
del working-expense-sheets WES-TEMP-001
post finance-petty-cash-transactions '{"entityId":"PTTY-TEMP-001","payload":{"id":"PTTY-TEMP-001","date":"2026-03-11","ref":"TEMP-PC-001","description":"Temp petty cash","amount":5000,"project":"General/PettyCash","admin":"System","type":"PETTY","source":"petty|accountCode=00000|direction=debit|kind=transaction"}}'
del finance-petty-cash-transactions PTTY-TEMP-001
post finance-bank-reconciliations '{"entityId":"BREC-TEMP-001","payload":{"id":"BREC-TEMP-001","date":"2026-03-11","periodLabel":"2026-03","account":"BCA-GTP","description":"Temp recon row","debit":10000,"credit":0,"balance":10000,"status":"Matched"}}'
del finance-bank-reconciliations BREC-TEMP-001
post kasbons '{"entityId":"KSB-TEMP-001","payload":{"id":"KSB-TEMP-001","date":"2026-03-11","amount":75000,"status":"Approved","approved":true,"employeeName":"Temp Worker"}}'
del kasbons KSB-TEMP-001
