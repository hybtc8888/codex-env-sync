param(
  [string]$CodexHome = $(if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }),
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$SyncedRoot = Join-Path $RepoRoot "synced"

& (Join-Path $PSScriptRoot "check-codex-sync-safety.ps1") -RepoRoot $RepoRoot

function Backup-IfExists {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  $backup = "$Path.backup"
  Write-Host "Backup: $Path -> $backup"
  if ($DryRun) {
    return
  }

  if (Test-Path -LiteralPath $backup) {
    Remove-Item -LiteralPath $backup -Recurse -Force
  }
  Move-Item -LiteralPath $Path -Destination $backup -Force
}

function Install-DirectoryContents {
  param(
    [string]$Source,
    [string]$Destination
  )

  if (-not (Test-Path -LiteralPath $Source)) {
    Write-Host "Skip missing synced directory: $Source"
    return
  }

  Backup-IfExists -Path $Destination
  Write-Host "Install directory: $Source -> $Destination"
  if ($DryRun) {
    return
  }

  New-Item -ItemType Directory -Force -Path $Destination | Out-Null
  Get-ChildItem -LiteralPath $Source -Force |
    Where-Object { $_.Name -ne ".gitkeep" } |
    Copy-Item -Destination $Destination -Recurse -Force
}

function Install-File {
  param(
    [string]$Source,
    [string]$Destination
  )

  if (-not (Test-Path -LiteralPath $Source)) {
    Write-Host "Skip missing synced file: $Source"
    return
  }

  Backup-IfExists -Path $Destination
  Write-Host "Install file: $Source -> $Destination"
  if ($DryRun) {
    return
  }

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
  Copy-Item -LiteralPath $Source -Destination $Destination -Force
}

if (-not $DryRun) {
  New-Item -ItemType Directory -Force -Path $CodexHome | Out-Null
}

Install-DirectoryContents -Source (Join-Path $SyncedRoot "skills") -Destination (Join-Path $CodexHome "skills")
Install-DirectoryContents -Source (Join-Path $SyncedRoot "prompts") -Destination (Join-Path $CodexHome "prompts")
Install-File -Source (Join-Path $SyncedRoot "config/config.toml") -Destination (Join-Path $CodexHome "config.toml")

Write-Host "Install complete. Run 'codex login' separately on this machine."

