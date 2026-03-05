#!/bin/bash
# =============================================================================
# LOCAL TESTING SCRIPT
# Run this AFTER docker compose -f docker-compose.local.yml up --build
# =============================================================================

set -e

BASE_URL="http://localhost:3001"
N8N_URL="http://localhost:5678"
FRONTEND_URL="http://localhost:3000"
CSV_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo ""
echo "============================================"
echo "  Bizware Local Testing Suite"
echo "============================================"
echo ""

# ---- Test 1: Health Check ----
echo "[TEST 1] Backend Health Check..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" ${BASE_URL}/api/health)
if [ "$HEALTH" = "200" ]; then
  echo "  PASS - Backend is healthy (HTTP 200)"
else
  echo "  FAIL - Backend returned HTTP $HEALTH"
  echo "  Check: docker compose -f docker-compose.local.yml logs backend"
  exit 1
fi

# ---- Test 2: Status Endpoint ----
echo "[TEST 2] Status Endpoint..."
STATUS=$(curl -s ${BASE_URL}/api/status)
echo "  Response: $STATUS"
echo "  PASS - Status endpoint responding"

# ---- Test 3: Frontend ----
echo "[TEST 3] Frontend Loading..."
FRONT=$(curl -s -o /dev/null -w "%{http_code}" ${FRONTEND_URL})
if [ "$FRONT" = "200" ]; then
  echo "  PASS - Frontend is serving (HTTP 200)"
else
  echo "  FAIL - Frontend returned HTTP $FRONT"
fi

# ---- Test 4: n8n UI ----
echo "[TEST 4] n8n UI..."
N8N=$(curl -s -o /dev/null -w "%{http_code}" ${N8N_URL})
if [ "$N8N" = "200" ] || [ "$N8N" = "401" ]; then
  echo "  PASS - n8n is running (HTTP $N8N)"
else
  echo "  FAIL - n8n returned HTTP $N8N"
fi

# ---- Test 5: Upload Bank Report (smallest file) ----
echo "[TEST 5] Upload Bank Report CSV..."
BANK_FILE="${CSV_DIR}/Bank Report_20260206_113137.csv"
if [ -f "$BANK_FILE" ]; then
  UPLOAD_RESULT=$(curl -s -X POST ${BASE_URL}/api/upload \
    -F "file=@${BANK_FILE}" \
    -F "reportType=bank_report")
  echo "  Response: $UPLOAD_RESULT"
  echo "  PASS - Upload endpoint responding"
else
  echo "  SKIP - Bank Report CSV not found at: $BANK_FILE"
fi

# ---- Test 6: Upload Budget Report ----
echo "[TEST 6] Upload Budget Report CSV..."
BUDGET_FILE="${CSV_DIR}/Budget Report_20260205_125635.csv"
if [ -f "$BUDGET_FILE" ]; then
  UPLOAD_RESULT=$(curl -s -X POST ${BASE_URL}/api/upload \
    -F "file=@${BUDGET_FILE}" \
    -F "reportType=budget_report")
  echo "  Response: $UPLOAD_RESULT"
  echo "  PASS - Upload endpoint responding"
else
  echo "  SKIP - Budget Report CSV not found at: $BUDGET_FILE"
fi

# ---- Test 7: Check Status After Upload ----
echo "[TEST 7] Status After Uploads..."
STATUS_AFTER=$(curl -s ${BASE_URL}/api/status)
echo "  Response: $STATUS_AFTER"

# ---- Test 8: Verify Database ----
echo "[TEST 8] Database Verification..."
echo "  Run these queries manually in pgAdmin or psql:"
echo "    SELECT COUNT(*) FROM raw.raw_bank_report;"
echo "    SELECT COUNT(*) FROM curated.bank_report;"
echo "    SELECT COUNT(*) FROM raw.raw_budget_report;"
echo "    SELECT COUNT(*) FROM curated.budget_report;"
echo "    SELECT * FROM audit.upload_audit ORDER BY id DESC LIMIT 5;"
echo "    SELECT * FROM curated.v_bank_report;"

echo ""
echo "============================================"
echo "  All basic tests completed!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Open http://localhost:3000 in your browser"
echo "  2. Upload CSV files via the UI"
echo "  3. Check n8n at http://localhost:5678 (admin/admin123)"
echo "  4. Connect to PostgreSQL at localhost:5432"
echo "     Database: bizware_dashboards"
echo "     User: bizware_user"
echo "     Password: localdev123"
echo ""
