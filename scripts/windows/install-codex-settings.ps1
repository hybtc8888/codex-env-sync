param(
  [string]$CodexHome = $(if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }),
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$Cli = Join-Path $ProjectRoot "src/cli.js"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is required to install Codex settings with safe merge."
}

$args = @("install", "--repo", $RepoRoot, "--codex-home", $CodexHome)
if ($DryRun) {
  $args += "--dry-run"
}

& node $Cli @args
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
