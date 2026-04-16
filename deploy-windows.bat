@echo off
REM ============================================================================
REM Bizware AI Chatbot Deployment Script for Windows
REM ============================================================================
REM Run this script on the remote server at C:\PowerBI_Prod\power-bi-dashboard
REM ============================================================================

echo.
echo ============================================================================
echo Bizware AI Chatbot - Windows Deployment
echo ============================================================================
echo.

REM Step 1: Pull latest code from Git
echo [Step 1/5] Pulling latest code from Git...
git pull origin master
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Git pull failed!
    pause
    exit /b 1
)
echo ✓ Code updated successfully
echo.

REM Step 2: Install backend dependencies
echo [Step 2/5] Installing backend dependencies...
cd backend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm install failed!
    pause
    exit /b 1
)
echo ✓ Dependencies installed successfully
cd ..
echo.

REM Step 3: Run database migration
echo [Step 3/5] Running database migration...
echo Connecting to PostgreSQL to add AI schema...

REM Create temporary SQL script runner
echo SET client_encoding = 'UTF8'; > run_migration.sql
type database\add-ai-schema.sql >> run_migration.sql

REM Run migration using psql (adjust credentials as needed)
set PGPASSWORD=BizwareProd@2026!
psql -h localhost -U bizware_user -d bizware_dashboards -f run_migration.sql
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Database migration may have failed. Check if already applied.
    echo Continue anyway? (Y/N)
    set /p continue=
    if /i not "%continue%"=="Y" exit /b 1
)
del run_migration.sql
echo ✓ Database migration completed
echo.

REM Step 4: Find and stop the current process
echo [Step 4/5] Stopping current application...
echo Finding process on port 14941...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :14941 ^| findstr LISTENING') do (
    set PID=%%a
)

if defined PID (
    echo Found process PID: %PID%
    echo Stopping process...
    taskkill /F /PID %PID%
    if %ERRORLEVEL% EQU 0 (
        echo ✓ Process stopped successfully
    ) else (
        echo WARNING: Could not stop process. May need manual intervention.
    )
    timeout /t 3 /nobreak >nul
) else (
    echo No process found on port 14941. Proceeding...
)
echo.

REM Step 5: Start the application
echo [Step 5/5] Starting application...
cd backend
start "Bizware Backend" cmd /k "npm start"
echo ✓ Application started
echo.

echo ============================================================================
echo Deployment Complete!
echo ============================================================================
echo.
echo The application should now be starting up.
echo Please wait 10-15 seconds, then test at: http://192.168.1.29:14941
echo.
echo Check the new window for any startup errors.
echo ============================================================================
echo.
pause
