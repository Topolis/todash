# Interactive Z-Wave USB stick attachment script for WSL2
# Run this in PowerShell as Administrator

Write-Host "=== Z-Wave USB Stick WSL2 Attachment ===" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# List all USB devices
Write-Host "Available USB devices:" -ForegroundColor Yellow
Write-Host ""
usbipd list
Write-Host ""

# Prompt for BUSID
Write-Host "Enter the BUSID of your Z-Wave stick (e.g., 1-4): " -ForegroundColor Green -NoNewline
$busid = Read-Host

if ([string]::IsNullOrWhiteSpace($busid)) {
    Write-Host "Error: No BUSID provided!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Bind the device (if not already bound)
Write-Host ""
Write-Host "Binding device $busid..." -ForegroundColor Cyan
try {
    usbipd bind --busid $busid 2>&1 | Out-Null
    Write-Host "Device bound successfully!" -ForegroundColor Green
} catch {
    Write-Host "Note: Device may already be bound (this is OK)" -ForegroundColor Yellow
}

# Attach to WSL2
Write-Host ""
Write-Host "Attaching device $busid to WSL2..." -ForegroundColor Cyan
try {
    usbipd attach --wsl --busid $busid
    Write-Host "Device attached successfully!" -ForegroundColor Green
} catch {
    Write-Host "Error: Failed to attach device!" -ForegroundColor Red
    Write-Host "Make sure WSL2 is running and you have administrator privileges." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Done! Verify in WSL2 with:" -ForegroundColor Green
Write-Host "  lsusb" -ForegroundColor White
Write-Host "  ls -la /dev/ttyACM*" -ForegroundColor White
Write-Host ""
Write-Host "The Z-Wave stick should be available at /dev/ttyACM0 or /dev/ttyUSB0" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit"

