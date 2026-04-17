# Restart Backend Script - MUST RUN AS ADMINISTRATOR
# This script kills the old backend process and starts a new one with correct configuration

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Bizware Backend Restart Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Kill process on port 3001
Write-Host "[1/3] Killing old backend process on port 3001..." -ForegroundColor Yellow

try {
    $connections = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue

    if ($connections) {
        foreach ($conn in $connections) {
            $pid = $conn.OwningProcess
            Write-Host "  Found process PID: $pid" -ForegroundColor Gray

            # Try to kill gracefully first
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2

            # Check if still running
            if (Get-Process -Id $pid -ErrorAction SilentlyContinue) {
                Write-Host "  Force killing PID $pid..." -ForegroundColor Red
                taskkill /F /PID $pid
            }
        }
        Write-Host "  ✓ Old process killed successfully" -ForegroundColor Green
    } else {
        Write-Host "  ✓ No process found on port 3001" -ForegroundColor Green
    }
} catch {
    Write-Host "  ⚠ Could not kill process (may need Administrator rights)" -ForegroundColor Yellow
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Step 2: Verify .env file exists
Write-Host "[2/3] Checking configuration..." -ForegroundColor Yellow

if (Test-Path ".env") {
    Write-Host "  ✓ .env file found" -ForegroundColor Green

    # Show DATABASE_URL (first 50 chars only for security)
    $dbUrl = Get-Content .env | Select-String "^DATABASE_URL=" | Select-Object -First 1
    if ($dbUrl) {
        $dbUrlShort = $dbUrl.ToString().Substring(0, [Math]::Min(60, $dbUrl.ToString().Length))
        Write-Host "  DATABASE_URL: $dbUrlShort..." -ForegroundColor Gray
    }
} else {
    Write-Host "  ✗ ERROR: .env file not found in backend directory!" -ForegroundColor Red
    Write-Host "  Please create backend/.env file first" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 3: Start backend
Write-Host "[3/3] Starting backend server..." -ForegroundColor Yellow
Write-Host "  Location: $PWD" -ForegroundColor Gray
Write-Host "  Command: node src/index.js" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Start the backend (this will block and show logs)
node src/index.js
