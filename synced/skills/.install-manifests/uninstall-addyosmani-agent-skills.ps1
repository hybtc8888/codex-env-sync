param(
  [switch]$Apply
)

$manifestPath = Join-Path $PSScriptRoot 'addyosmani-agent-skills.json'
if (-not (Test-Path $manifestPath)) {
  throw "Manifest not found: $manifestPath"
}

$manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
$targets = @($manifest.installed | ForEach-Object { $_.destination })

if (-not $Apply) {
  Write-Host "Dry run. These directories would be removed:"
  $targets | ForEach-Object { Write-Host "  $_" }
  Write-Host "Run with -Apply to remove them. Skipped/pre-existing skills are not removed."
  exit 0
}

foreach ($target in $targets) {
  if ($target -and (Test-Path -LiteralPath $target)) {
    Remove-Item -LiteralPath $target -Recurse -Force
    Write-Host "Removed: $target"
  }
}

Write-Host "Done. You may also remove the manifest files if you no longer need the record."
