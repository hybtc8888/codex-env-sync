param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"
$failed = 0

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Assert-FileText {
  param([string]$Path, [string]$Expected)
  Assert-True (Test-Path -LiteralPath $Path) "Expected file missing: $Path"
  $actual = Get-Content -Raw -Encoding utf8 -LiteralPath $Path
  Assert-True ($actual -eq $Expected) "Unexpected file content in: $Path"
}

function Run-Test {
  param([string]$Name, [scriptblock]$Body)
  try {
    & $Body
    Write-Host "PASS $Name" -ForegroundColor Green
  } catch {
    $script:failed += 1
    Write-Host "FAIL $Name" -ForegroundColor Red
    Write-Host $_.Exception.Message
  }
}

function New-TempFolder {
  $path = Join-Path ([System.IO.Path]::GetTempPath()) ("codex-env-sync-test-" + [System.Guid]::NewGuid())
  New-Item -ItemType Directory -Force -Path $path | Out-Null
  return $path
}

Run-Test "safety check rejects auth files" {
  $repo = New-TempFolder
  try {
    New-Item -ItemType Directory -Force -Path (Join-Path $repo "synced/skills") | Out-Null
    & (Join-Path $ProjectRoot "scripts/windows/check-codex-sync-safety.ps1") -RepoRoot $repo

    New-Item -ItemType File -Force -Path (Join-Path $repo "synced/auth.json") | Out-Null
    $failedAsExpected = $false
    try {
      & (Join-Path $ProjectRoot "scripts/windows/check-codex-sync-safety.ps1") -RepoRoot $repo
    } catch {
      $failedAsExpected = $true
    }
    Assert-True $failedAsExpected "auth.json should fail the safety check."
  } finally {
    Remove-Item -LiteralPath $repo -Recurse -Force
  }
}

Run-Test "export copies safe assets and excludes runtime files" {
  $codexHome = New-TempFolder
  $repo = New-TempFolder
  try {
    New-Item -ItemType Directory -Force -Path (Join-Path $codexHome "skills/demo/.venv/pkg") | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $codexHome "prompts") | Out-Null
    Set-Content -Encoding utf8 -LiteralPath (Join-Path $codexHome "skills/demo/SKILL.md") -Value "skill-body" -NoNewline
    Set-Content -Encoding utf8 -LiteralPath (Join-Path $codexHome "skills/demo/.venv/pkg/session.py") -Value "runtime" -NoNewline
    Set-Content -Encoding utf8 -LiteralPath (Join-Path $codexHome "prompts/base.md") -Value "prompt-body" -NoNewline
    Set-Content -Encoding utf8 -LiteralPath (Join-Path $codexHome "config.toml") -Value "model = `"test`"`n[projects.`"C:\\tmp`"]`ntrusted = true" -NoNewline
    Set-Content -Encoding utf8 -LiteralPath (Join-Path $codexHome "auth.json") -Value "{}" -NoNewline

    & (Join-Path $ProjectRoot "scripts/windows/export-codex-settings.ps1") -CodexHome $codexHome -RepoRoot $repo

    Assert-FileText (Join-Path $repo "synced/skills/demo/SKILL.md") "skill-body"
    Assert-FileText (Join-Path $repo "synced/prompts/base.md") "prompt-body"
    Assert-FileText (Join-Path $repo "synced/config/config.toml") "model = `"test`""
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $repo "synced/skills/demo/.venv"))) "Runtime .venv must not be exported."
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $repo "synced/auth.json"))) "auth.json must not be exported."
  } finally {
    Remove-Item -LiteralPath $codexHome -Recurse -Force
    Remove-Item -LiteralPath $repo -Recurse -Force
  }
}

Run-Test "install merges synced assets and preserves auth" {
  $codexHome = New-TempFolder
  $repo = New-TempFolder
  try {
    New-Item -ItemType Directory -Force -Path (Join-Path $repo "synced/skills/demo") | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $repo "synced/prompts") | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $repo "synced/config") | Out-Null
    Set-Content -Encoding utf8 -LiteralPath (Join-Path $repo "synced/skills/demo/SKILL.md") -Value "new-skill" -NoNewline
    Set-Content -Encoding utf8 -LiteralPath (Join-Path $repo "synced/prompts/base.md") -Value "new-prompt" -NoNewline
    Set-Content -Encoding utf8 -LiteralPath (Join-Path $repo "synced/config/config.toml") -Value "model = `"new`"" -NoNewline

    New-Item -ItemType Directory -Force -Path (Join-Path $codexHome "skills/old") | Out-Null
    Set-Content -Encoding utf8 -LiteralPath (Join-Path $codexHome "skills/old/SKILL.md") -Value "old-skill" -NoNewline
    Set-Content -Encoding utf8 -LiteralPath (Join-Path $codexHome "auth.json") -Value "local-auth" -NoNewline

    & (Join-Path $ProjectRoot "scripts/windows/install-codex-settings.ps1") -CodexHome $codexHome -RepoRoot $repo

    Assert-FileText (Join-Path $codexHome "skills/demo/SKILL.md") "new-skill"
    Assert-FileText (Join-Path $codexHome "prompts/base.md") "new-prompt"
    Assert-FileText (Join-Path $codexHome "config.toml") "model = `"new`""
    Assert-FileText (Join-Path $codexHome "skills/old/SKILL.md") "old-skill"
    Assert-FileText (Join-Path $codexHome "auth.json") "local-auth"
  } finally {
    Remove-Item -LiteralPath $codexHome -Recurse -Force
    Remove-Item -LiteralPath $repo -Recurse -Force
  }
}

Run-Test "macOS install script has valid shell syntax when bash is available" {
  $scriptPath = Join-Path $ProjectRoot "scripts/macos/install-codex-settings.sh"
  Assert-True (Test-Path -LiteralPath $scriptPath) "Expected macOS install script missing: $scriptPath"
  $bash = Get-Command bash -ErrorAction SilentlyContinue
  if ($null -eq $bash) {
    Write-Host "SKIP bash not available on this machine." -ForegroundColor Yellow
    return
  }

  & bash -n $scriptPath
  Assert-True ($LASTEXITCODE -eq 0) "macOS install script should pass bash syntax check."
}

if ($failed -gt 0) {
  Write-Host "$failed test(s) failed." -ForegroundColor Red
  exit 1
}

Write-Host "All tests passed." -ForegroundColor Green

