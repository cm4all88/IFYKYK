# ──────────────────────────────────────────────────────────────────
# Spotlightly batch deploy tool
#
# Usage (from repo root):
#   .\tools\deploy.ps1
#       -> looks in $env:USERPROFILE\Downloads for the newest folder
#          containing manifest.json, deploys from there
#
#   .\tools\deploy.ps1 -From "C:\path\to\batch-folder"
#       -> deploys from a specific folder
#
#   .\tools\deploy.ps1 -DryRun
#       -> shows what would happen without changing anything
#
# What it does:
#   1. Finds manifest.json in the source folder
#   2. For each entry, ensures the destination folder exists
#   3. Copies the source file to its destination
#   4. Forces UTF-8-no-BOM encoding (avoids the encoding bug we hit)
#   5. Runs any post-deploy PowerShell patches listed in the manifest
#   6. Reports placed / skipped / patched / errors
#
# manifest.json shape:
#   {
#     "name": "v3",
#     "files": [
#       { "src": "admin-page.tsx",      "dst": "app/admin/page.tsx" },
#       { "src": "lib-settings.ts",     "dst": "lib/settings.ts" },
#       ...
#     ],
#     "patches": [
#       {
#         "file": "app/(platform)/dashboard/page.tsx",
#         "find": "tier: profile.creator_type,",
#         "replace": "tier: \"free\","
#       }
#     ]
#   }
# ──────────────────────────────────────────────────────────────────

[CmdletBinding()]
param(
  [string]$From = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# Color helpers
function Write-Step  ($m) { Write-Host "→ $m" -ForegroundColor Cyan }
function Write-Ok    ($m) { Write-Host "  ✓ $m" -ForegroundColor Green }
function Write-Skip  ($m) { Write-Host "  ○ $m" -ForegroundColor DarkGray }
function Write-Warn  ($m) { Write-Host "  ⚠ $m" -ForegroundColor Yellow }
function Write-Bad   ($m) { Write-Host "  ✗ $m" -ForegroundColor Red }

# ──────────────────────────────────────────────────────────────────
# 1. Resolve source folder
# ──────────────────────────────────────────────────────────────────

if (-not $From) {
  Write-Step "Looking for newest batch folder in Downloads..."
  $candidates = Get-ChildItem -Path "$env:USERPROFILE\Downloads" -Directory -ErrorAction SilentlyContinue |
    Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "manifest.json") } |
    Sort-Object LastWriteTime -Descending

  if (-not $candidates -or $candidates.Count -eq 0) {
    Write-Bad "No batch folder with manifest.json found in Downloads."
    Write-Host ""
    Write-Host "Either:"
    Write-Host "  - Unzip the batch into a folder under Downloads, OR"
    Write-Host "  - Pass the path explicitly: .\tools\deploy.ps1 -From 'C:\path\to\batch'"
    exit 1
  }

  $From = $candidates[0].FullName
  Write-Ok "Found: $From"
}

if (-not (Test-Path -LiteralPath $From)) {
  Write-Bad "Source folder does not exist: $From"
  exit 1
}

$manifestPath = Join-Path $From "manifest.json"
if (-not (Test-Path -LiteralPath $manifestPath)) {
  Write-Bad "manifest.json not found in: $From"
  exit 1
}

# ──────────────────────────────────────────────────────────────────
# 2. Parse manifest
# ──────────────────────────────────────────────────────────────────

Write-Step "Reading manifest..."
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$batchName = if ($manifest.name) { $manifest.name } else { "(unnamed)" }
$fileCount = if ($manifest.files) { @($manifest.files).Count } else { 0 }
$patchCount = if ($manifest.patches) { @($manifest.patches).Count } else { 0 }

Write-Ok "Batch: $batchName"
Write-Ok "Files to place: $fileCount"
Write-Ok "Post-deploy patches: $patchCount"

if ($DryRun) {
  Write-Warn "DRY RUN — no files will be modified."
}

Write-Host ""

# ──────────────────────────────────────────────────────────────────
# 3. Place files
# ──────────────────────────────────────────────────────────────────

$placed = 0
$skipped = 0
$failed = 0

if ($fileCount -gt 0) {
  Write-Step "Placing $fileCount files..."
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false

  foreach ($entry in $manifest.files) {
    $srcPath = Join-Path $From $entry.src
    $dstPath = Join-Path (Get-Location) $entry.dst

    if (-not (Test-Path -LiteralPath $srcPath)) {
      Write-Bad "MISSING src: $($entry.src)"
      $failed++
      continue
    }

    # Ensure destination folder exists
    $dstDir = Split-Path -LiteralPath $dstPath -Parent
    if (-not (Test-Path -LiteralPath $dstDir)) {
      if ($DryRun) {
        Write-Skip "would mkdir: $dstDir"
      } else {
        New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
      }
    }

    if ($DryRun) {
      Write-Skip "would place: $($entry.src) -> $($entry.dst)"
      $skipped++
      continue
    }

    # Read source as text, write destination as UTF-8 no BOM
    try {
      $content = [System.IO.File]::ReadAllText($srcPath)
      [System.IO.File]::WriteAllText($dstPath, $content, $utf8NoBom)
      Write-Ok "$($entry.dst) ($([System.IO.File]::ReadAllBytes($dstPath).Length) bytes)"
      $placed++
    } catch {
      Write-Bad "FAILED $($entry.dst): $($_.Exception.Message)"
      $failed++
    }
  }
}

# ──────────────────────────────────────────────────────────────────
# 4. Apply patches
# ──────────────────────────────────────────────────────────────────

$patched = 0
$patchSkipped = 0
$patchFailed = 0

if ($patchCount -gt 0) {
  Write-Host ""
  Write-Step "Applying $patchCount post-deploy patches..."
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false

  foreach ($patch in $manifest.patches) {
    $targetPath = Join-Path (Get-Location) $patch.file

    if (-not (Test-Path -LiteralPath $targetPath)) {
      Write-Warn "patch target missing: $($patch.file) — skipping"
      $patchSkipped++
      continue
    }

    try {
      $content = [System.IO.File]::ReadAllText($targetPath)

      if ($content -notlike "*$($patch.find)*") {
        # Already patched, or text has changed — log and skip
        Write-Skip "$($patch.file): pattern not present (already patched, or stale)"
        $patchSkipped++
        continue
      }

      if ($DryRun) {
        Write-Skip "would patch: $($patch.file)"
        $patchSkipped++
        continue
      }

      # Use literal string replace, not regex — patch content shouldn't be regex
      $newContent = $content.Replace($patch.find, $patch.replace)
      [System.IO.File]::WriteAllText($targetPath, $newContent, $utf8NoBom)
      Write-Ok "patched: $($patch.file)"
      $patched++
    } catch {
      Write-Bad "PATCH FAILED $($patch.file): $($_.Exception.Message)"
      $patchFailed++
    }
  }
}

# ──────────────────────────────────────────────────────────────────
# 5. Report
# ──────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "─────────────────────────────────────────"
Write-Host "Deploy summary: $batchName" -ForegroundColor Cyan
Write-Host "─────────────────────────────────────────"
if ($placed -gt 0)       { Write-Host "  Files placed:   $placed" -ForegroundColor Green }
if ($skipped -gt 0)      { Write-Host "  Files skipped:  $skipped" -ForegroundColor DarkGray }
if ($failed -gt 0)       { Write-Host "  Files FAILED:   $failed" -ForegroundColor Red }
if ($patched -gt 0)      { Write-Host "  Patches applied:  $patched" -ForegroundColor Green }
if ($patchSkipped -gt 0) { Write-Host "  Patches skipped:  $patchSkipped" -ForegroundColor DarkGray }
if ($patchFailed -gt 0)  { Write-Host "  Patches FAILED:   $patchFailed" -ForegroundColor Red }
Write-Host ""

if ($manifest.notes) {
  Write-Host "─────────────────────────────────────────"
  Write-Host "NOTES from this batch:" -ForegroundColor Yellow
  Write-Host "─────────────────────────────────────────"
  Write-Host $manifest.notes
  Write-Host ""
}

if ($failed -gt 0 -or $patchFailed -gt 0) {
  exit 1
}

if (-not $DryRun) {
  Write-Host "Next:" -ForegroundColor Cyan
  Write-Host "  npm run build"
  Write-Host ""
}
