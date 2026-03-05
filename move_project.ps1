# ===================================================================
# MoodMateAI - Move project to shorter path to fix Windows 260-char limit
# Run this script AFTER closing VS Code / any editor with this project open
# Run as Administrator for best results (right-click PowerShell > Run as Admin)
# ===================================================================

$source = "D:\Project\MoodMateAI"
$dest   = "D:\MM"

Write-Host "=== MoodMateAI Project Path Fix ===" -ForegroundColor Cyan
Write-Host ""

# Check if destination already exists
if (Test-Path $dest) {
    Write-Host "WARNING: $dest already exists. Please remove it first or choose a different destination." -ForegroundColor Red
    exit 1
}

# Check source exists
if (-not (Test-Path $source)) {
    Write-Host "ERROR: Source folder not found: $source" -ForegroundColor Red
    exit 1
}

Write-Host "Clearing CMake build cache (.cxx folder)..." -ForegroundColor Yellow
Remove-Item -Recurse -Force "$source\android\app\.cxx" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$source\android\build"    -ErrorAction SilentlyContinue
Write-Host "Done." -ForegroundColor Green

Write-Host ""
Write-Host "Moving project from $source to $dest ..." -ForegroundColor Yellow
Write-Host "(This may take a while for node_modules...)"

Move-Item -Path $source -Destination $dest

if (Test-Path $dest) {
    Write-Host "Move successful!" -ForegroundColor Green
} else {
    Write-Host "ERROR: Move failed. Project may still be in use. Close all editors and try again." -ForegroundColor Red
    exit 1
}

# Update/create C:\mm junction to new location
Write-Host ""
Write-Host "Updating C:\mm junction to point to $dest ..." -ForegroundColor Yellow
if (Test-Path "C:\mm") {
    Remove-Item "C:\mm" -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Junction -Path "C:\mm" -Target $dest | Out-Null
Write-Host "Junction C:\mm -> $dest created." -ForegroundColor Green

Write-Host ""
Write-Host "=== All done! ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Open VS Code from the NEW location: $dest"
Write-Host "  2. Run: npx expo run:android"
Write-Host ""
Write-Host "NOTE: If you use git, the remote URL is unchanged. Just update any local scripts."
