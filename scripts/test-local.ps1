# =============================================================================
# LOCAL TESTING SCRIPT (PowerShell for Windows)
# Run this AFTER: docker compose -f docker-compose.local.yml up --build
# =============================================================================

$ErrorActionPreference = "Continue"

$BASE_URL = "http://localhost:3001"
$N8N_URL = "http://localhost:5678"
$FRONTEND_URL = "http://localhost:3000"
$CSV_DIR = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Bizware Local Testing Suite (PowerShell)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ---- Test 1: Health Check ----
Write-Host "[TEST 1] Backend Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$BASE_URL/api/health" -Method Get
    Write-Host "  PASS - Backend is healthy: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "  FAIL - Backend not reachable: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Run: docker compose -f docker-compose.local.yml logs backend" -ForegroundColor Red
}

# ---- Test 2: Status Endpoint ----
Write-Host "[TEST 2] Status Endpoint..." -ForegroundColor Yellow
try {
    $status = Invoke-RestMethod -Uri "$BASE_URL/api/status" -Method Get
    foreach ($report in $status.reports) {
        Write-Host "  $($report.report_type): status=$($report.status), last=$($report.last_uploaded), rows=$($report.rows_total)"
    }
    Write-Host "  PASS - Status endpoint responding" -ForegroundColor Green
} catch {
    Write-Host "  FAIL - Status endpoint error: $($_.Exception.Message)" -ForegroundColor Red
}

# ---- Test 3: Frontend ----
Write-Host "[TEST 3] Frontend Loading..." -ForegroundColor Yellow
try {
    $frontResp = Invoke-WebRequest -Uri $FRONTEND_URL -UseBasicParsing
    Write-Host "  PASS - Frontend is serving (HTTP $($frontResp.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  FAIL - Frontend not reachable: $($_.Exception.Message)" -ForegroundColor Red
}

# ---- Test 4: n8n UI ----
Write-Host "[TEST 4] n8n UI..." -ForegroundColor Yellow
try {
    $n8nResp = Invoke-WebRequest -Uri $N8N_URL -UseBasicParsing
    Write-Host "  PASS - n8n is running (HTTP $($n8nResp.StatusCode))" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "  PASS - n8n is running (HTTP 401 - auth required)" -ForegroundColor Green
    } else {
        Write-Host "  FAIL - n8n not reachable: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ---- Test 5: Upload Bank Report ----
Write-Host "[TEST 5] Upload Bank Report CSV..." -ForegroundColor Yellow
$bankFile = Join-Path $CSV_DIR "Bank Report_20260206_113137.csv"
if (Test-Path $bankFile) {
    try {
        $form = @{
            file = Get-Item $bankFile
            reportType = "bank_report"
        }
        $uploadResult = Invoke-RestMethod -Uri "$BASE_URL/api/upload" -Method Post -Form $form
        Write-Host "  Response: status=$($uploadResult.status), report=$($uploadResult.reportType)" -ForegroundColor Green
        if ($uploadResult.result) {
            Write-Host "  n8n result: $($uploadResult.result | ConvertTo-Json -Compress)" -ForegroundColor Gray
        }
        Write-Host "  PASS - Bank Report uploaded" -ForegroundColor Green
    } catch {
        Write-Host "  FAIL - Upload error: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errBody = $reader.ReadToEnd()
            Write-Host "  Error body: $errBody" -ForegroundColor Red
        }
    }
} else {
    Write-Host "  SKIP - Bank Report CSV not found at: $bankFile" -ForegroundColor DarkYellow
}

# ---- Test 6: Upload Budget Report ----
Write-Host "[TEST 6] Upload Budget Report CSV..." -ForegroundColor Yellow
$budgetFile = Join-Path $CSV_DIR "Budget Report_20260205_125635.csv"
if (Test-Path $budgetFile) {
    try {
        $form = @{
            file = Get-Item $budgetFile
            reportType = "budget_report"
        }
        $uploadResult = Invoke-RestMethod -Uri "$BASE_URL/api/upload" -Method Post -Form $form
        Write-Host "  PASS - Budget Report uploaded: status=$($uploadResult.status)" -ForegroundColor Green
    } catch {
        Write-Host "  FAIL - Upload error: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "  SKIP - Budget Report CSV not found" -ForegroundColor DarkYellow
}

# ---- Test 7: Upload Sales Register ----
Write-Host "[TEST 7] Upload Sales Register CSV..." -ForegroundColor Yellow
$salesFile = Join-Path $CSV_DIR "Sales Register_20260205_120444.csv"
if (Test-Path $salesFile) {
    try {
        $form = @{
            file = Get-Item $salesFile
            reportType = "sales_register"
        }
        $uploadResult = Invoke-RestMethod -Uri "$BASE_URL/api/upload" -Method Post -Form $form
        Write-Host "  PASS - Sales Register uploaded: status=$($uploadResult.status)" -ForegroundColor Green
    } catch {
        Write-Host "  FAIL - Upload error: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "  SKIP - Sales Register CSV not found" -ForegroundColor DarkYellow
}

# ---- Test 8: Upload Accounts Payable ----
Write-Host "[TEST 8] Upload Accounts Payable CSV..." -ForegroundColor Yellow
$apFile = Join-Path $CSV_DIR "Accounts Payable_20260205_111233.csv"
if (Test-Path $apFile) {
    try {
        $form = @{
            file = Get-Item $apFile
            reportType = "accounts_payable"
        }
        $uploadResult = Invoke-RestMethod -Uri "$BASE_URL/api/upload" -Method Post -Form $form
        Write-Host "  PASS - Accounts Payable uploaded: status=$($uploadResult.status)" -ForegroundColor Green
    } catch {
        Write-Host "  FAIL - Upload error: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "  SKIP - Accounts Payable CSV not found" -ForegroundColor DarkYellow
}

# ---- Test 9: Verify Status After Uploads ----
Write-Host "[TEST 9] Status After Uploads..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
try {
    $statusAfter = Invoke-RestMethod -Uri "$BASE_URL/api/status" -Method Get
    foreach ($report in $statusAfter.reports) {
        $color = if ($report.status -eq "success") { "Green" } elseif ($report.status -eq "pending") { "DarkYellow" } else { "Red" }
        Write-Host "  $($report.report_type): status=$($report.status), rows=$($report.rows_total), last=$($report.last_uploaded)" -ForegroundColor $color
    }
} catch {
    Write-Host "  Could not fetch status: $($_.Exception.Message)" -ForegroundColor Red
}

# ---- Test 10: Validation Error Tests ----
Write-Host "[TEST 10] Validation - Missing report type..." -ForegroundColor Yellow
try {
    $form = @{ file = Get-Item $bankFile }
    $result = Invoke-RestMethod -Uri "$BASE_URL/api/upload" -Method Post -Form $form
    Write-Host "  FAIL - Should have returned error" -ForegroundColor Red
} catch {
    Write-Host "  PASS - Correctly rejected (missing reportType)" -ForegroundColor Green
}

Write-Host "[TEST 11] Validation - Invalid report type..." -ForegroundColor Yellow
try {
    $form = @{
        file = Get-Item $bankFile
        reportType = "invalid_type"
    }
    $result = Invoke-RestMethod -Uri "$BASE_URL/api/upload" -Method Post -Form $form
    Write-Host "  FAIL - Should have returned error" -ForegroundColor Red
} catch {
    Write-Host "  PASS - Correctly rejected (invalid reportType)" -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  All tests completed!" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Manual verification steps:" -ForegroundColor Yellow
Write-Host "  1. Open http://localhost:3000 in browser (Frontend)" -ForegroundColor White
Write-Host "  2. Open http://localhost:5678 in browser (n8n - admin/admin123)" -ForegroundColor White
Write-Host "  3. Connect to PostgreSQL:" -ForegroundColor White
Write-Host "     Host: localhost, Port: 5432" -ForegroundColor Gray
Write-Host "     Database: bizware_dashboards" -ForegroundColor Gray
Write-Host "     User: bizware_user, Password: localdev123" -ForegroundColor Gray
Write-Host ""
Write-Host "  Database queries to verify:" -ForegroundColor Yellow
Write-Host "     SELECT COUNT(*) FROM raw.raw_bank_report;" -ForegroundColor Gray
Write-Host "     SELECT COUNT(*) FROM curated.bank_report;" -ForegroundColor Gray
Write-Host "     SELECT * FROM curated.v_bank_report;" -ForegroundColor Gray
Write-Host "     SELECT * FROM curated.v_budget_report;" -ForegroundColor Gray
Write-Host "     SELECT * FROM audit.upload_audit ORDER BY id DESC;" -ForegroundColor Gray
Write-Host ""
