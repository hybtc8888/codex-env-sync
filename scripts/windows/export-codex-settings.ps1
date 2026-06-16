param(
  [string]$CodexHome = $(if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }),
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$SyncedRoot = Join-Path $RepoRoot "synced"

function Copy-SafeDirectoryContents {
  param(
    [string]$Source,
    [string]$Destination
  )

  if (-not (Test-Path -LiteralPath $Source)) {
    Write-Host "Skip missing directory: $Source"
    return
  }

  Write-Host "Export directory: $Source -> $Destination"
  if ($DryRun) {
    return
  }

  if (Test-Path -LiteralPath $Destination) {
    Get-ChildItem -LiteralPath $Destination -Force |
      Where-Object { $_.Name -ne ".gitkeep" } |
      Remove-Item -Recurse -Force
  } else {
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
  }

  $excludedDirectoryNames = @(".git", ".venv", "venv", "env", "node_modules", "__pycache__", ".cache", "dist", "build", "reports", "outputs", "backups")
  $excludedFileNames = @("auth.json", "history.jsonl")
  $excludedFileExtensions = @(".pyc", ".pyo", ".log", ".tmp")
  $sourcePrefix = (Resolve-Path -LiteralPath $Source).Path.TrimEnd("\", "/") + [System.IO.Path]::DirectorySeparatorChar

  Get-ChildItem -LiteralPath $Source -Recurse -Force -File |
    ForEach-Object {
      $relative = $_.FullName.Substring($sourcePrefix.Length)
      $parts = $relative -split '[\\/]'
      $hasExcludedDirectory = $false
      if ($parts.Count -gt 1) {
        foreach ($part in $parts[0..($parts.Count - 2)]) {
          if ($excludedDirectoryNames -contains $part) {
            $hasExcludedDirectory = $true
          }
        }
      }

      if ($hasExcludedDirectory) { return }
      if ($excludedFileNames -contains $_.Name) { return }
      if ($_.Name -match "(?i)(token|session|credential|secret)") { return }
      if ($excludedFileExtensions -contains $_.Extension) { return }

      $target = Join-Path $Destination $relative
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
      Copy-Item -LiteralPath $_.FullName -Destination $target -Force
    }
}

function Export-SanitizedConfig {
  param(
    [string]$Source,
    [string]$Destination
  )

  if (-not (Test-Path -LiteralPath $Source)) {
    Write-Host "Skip missing file: $Source"
    return
  }

  Write-Host "Export sanitized config: $Source -> $Destination"
  if ($DryRun) {
    return
  }

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null

  $lines = Get-Content -Encoding utf8 -LiteralPath $Source
  $output = New-Object System.Collections.Generic.List[string]
  $skipProjectBlock = $false

  foreach ($line in $lines) {
    if ($line -match '^\s*\[projects(\.|")') {
      $skipProjectBlock = $true
      continue
    }

    if ($skipProjectBlock -and $line -match '^\s*\[') {
      $skipProjectBlock = $false
    }

    if (-not $skipProjectBlock) {
      $output.Add($line)
    }
  }

  Set-Content -Encoding utf8 -LiteralPath $Destination -Value ($output -join [Environment]::NewLine) -NoNewline
}

Write-Host "Protected from export: auth.json, history.jsonl, tokens, sessions, credentials, secrets, virtual environments, caches, and reports."

Copy-SafeDirectoryContents -Source (Join-Path $CodexHome "skills") -Destination (Join-Path $SyncedRoot "skills")
Copy-SafeDirectoryContents -Source (Join-Path $CodexHome "prompts") -Destination (Join-Path $SyncedRoot "prompts")
Export-SanitizedConfig -Source (Join-Path $CodexHome "config.toml") -Destination (Join-Path $SyncedRoot "config/config.toml")

& (Join-Path $PSScriptRoot "check-codex-sync-safety.ps1") -RepoRoot $RepoRoot
Write-Host "Export complete."

