param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
)

$ErrorActionPreference = "Stop"

$forbiddenNamePatterns = @(
  "auth.json",
  "*token*",
  "*session*",
  "*credential*",
  "*secret*",
  ".env"
)

$ignoredPathPattern = "\\(\.git|backups|node_modules|\.venv|venv|env|__pycache__|\.cache|dist|build|release|reports|outputs)\\"
$violations = New-Object System.Collections.Generic.List[string]

foreach ($pattern in $forbiddenNamePatterns) {
  Get-ChildItem -LiteralPath $RepoRoot -Recurse -Force -File -Filter $pattern |
    Where-Object { $_.FullName -notmatch $ignoredPathPattern } |
    ForEach-Object { $violations.Add($_.FullName) }
}

$secretValuePattern = "(?i)(sk-[a-z0-9_-]{20,}|xox[baprs]-[a-z0-9-]{20,}|gh[pousr]_[a-z0-9_]{20,})"
$unsafeConfigKeyPattern = "(?im)^\s*[A-Za-z0-9_.-]*(api[_-]?key|token|secret|password|credential)[A-Za-z0-9_.-]*\s*="
Get-ChildItem -LiteralPath $RepoRoot -Recurse -Force -File |
  Where-Object { $_.FullName -notmatch $ignoredPathPattern } |
  ForEach-Object {
    $content = Get-Content -Raw -ErrorAction SilentlyContinue -LiteralPath $_.FullName
    if ($content -match $secretValuePattern) {
      $violations.Add($_.FullName)
    } elseif ($_.Name -eq "config.toml" -and $content -match $unsafeConfigKeyPattern) {
      $violations.Add($_.FullName)
    }
  }

if ($violations.Count -gt 0) {
  Write-Host "Unsafe files or secret-looking values found:" -ForegroundColor Red
  $violations |
    Sort-Object -Unique |
    ForEach-Object {
      $relative = Resolve-Path -LiteralPath $_ -Relative
      Write-Host " - $relative"
    }
  throw "Safety check failed."
}

Write-Host "Safety check passed: no account files or obvious secrets found." -ForegroundColor Green
