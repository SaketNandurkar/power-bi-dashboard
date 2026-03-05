# ===========================================================================
# Create Windows Scheduled Task to sync CSV files to RDP share every hour
# (Matches SAP sync schedule: 0 * * * * = hourly)
# Run this script AS ADMINISTRATOR
# ===========================================================================

$ErrorActionPreference = "Stop"

$taskName = "Bizware_Sync_CSV_to_RDP"
$scriptPath = "E:\Codouble\Bizware\power-bi-dashboards\sync_to_rdp.ps1"
$description = "Automatically sync Power BI CSV files to RDP network share every hour (matches SAP sync schedule)"

Write-Host "=== Setting up Scheduled Task ===" -ForegroundColor Cyan

try {
    # Remove existing task if it exists
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Write-Host "Removing existing task..." -ForegroundColor Yellow
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }

    # Create the action (run PowerShell script)
    $action = New-ScheduledTaskAction `
        -Execute "powershell.exe" `
        -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""

    # Create the trigger (every hour at minute 2 to give SAP sync time to complete)
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Hours 1)

    # Set to start at 2 minutes past the hour to ensure SAP sync completes first
    $trigger.StartBoundary = (Get-Date).Date.AddMinutes(2).ToString("yyyy-MM-dd'T'HH:mm:ss")

    # Create the settings
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -RunOnlyIfNetworkAvailable `
        -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

    # Create the principal (run as current user)
    $principal = New-ScheduledTaskPrincipal `
        -UserId "$env:USERDOMAIN\$env:USERNAME" `
        -LogonType Interactive `
        -RunLevel Highest

    # Register the task
    Register-ScheduledTask `
        -TaskName $taskName `
        -Description $description `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal

    Write-Host "`n=== SUCCESS ===" -ForegroundColor Green
    Write-Host "Scheduled task '$taskName' created successfully!" -ForegroundColor Green
    Write-Host "Sync frequency: Every 1 hour (at 2 minutes past the hour)" -ForegroundColor Green
    Write-Host "This matches your SAP sync schedule (hourly)." -ForegroundColor Cyan
    Write-Host "`nTo change sync frequency, modify SAP_SYNC_CRON and re-run this script." -ForegroundColor Yellow
    Write-Host "`nTo view the task:" -ForegroundColor Cyan
    Write-Host "  taskschd.msc" -ForegroundColor White
    Write-Host "`nTo test the task now:" -ForegroundColor Cyan
    Write-Host "  Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor White
    Write-Host "`nTo stop/disable the task:" -ForegroundColor Cyan
    Write-Host "  Disable-ScheduledTask -TaskName '$taskName'" -ForegroundColor White
    Write-Host "`nTo remove the task:" -ForegroundColor Cyan
    Write-Host "  Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false" -ForegroundColor White

} catch {
    Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Make sure you're running this script AS ADMINISTRATOR" -ForegroundColor Yellow
    exit 1
}
