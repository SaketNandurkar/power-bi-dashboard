# ===========================================================================
# Sync CSV files from local Docker volume to RDP network share
# ===========================================================================

$ErrorActionPreference = "Stop"

$localPath = "E:\Codouble\Bizware\power-bi-dashboards\powerbi_exports"
$remotePath = "Z:\"
$logFile = "E:\Codouble\Bizware\power-bi-dashboards\sync_to_rdp.log"

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Add-Content -Path $logFile -Value $logMessage
    Write-Host $logMessage
}

try {
    Write-Log "Starting sync to RDP share..."

    # Check if local directory exists
    if (-not (Test-Path $localPath)) {
        Write-Log "ERROR: Local directory not found: $localPath"
        exit 1
    }

    # Check if Z: drive is mounted
    if (-not (Test-Path "Z:\")) {
        Write-Log "ERROR: Z: drive not mounted. Please run the mount script first."
        exit 1
    }

    # Copy all CSV files
    $csvFiles = Get-ChildItem -Path $localPath -Filter "*.csv" -File

    if ($csvFiles.Count -eq 0) {
        Write-Log "No CSV files found to sync."
        exit 0
    }

    $copiedCount = 0
    foreach ($file in $csvFiles) {
        try {
            Copy-Item -Path $file.FullName -Destination $remotePath -Force
            Write-Log "Copied: $($file.Name) ($('{0:N0}' -f $file.Length) bytes)"
            $copiedCount++
        } catch {
            Write-Log "ERROR copying $($file.Name): $($_.Exception.Message)"
        }
    }

    Write-Log "Sync completed successfully. $copiedCount file(s) copied to RDP share."
    exit 0

} catch {
    Write-Log "ERROR: $($_.Exception.Message)"
    Write-Log "StackTrace: $($_.ScriptStackTrace)"
    exit 1
}
