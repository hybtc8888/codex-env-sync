# Codex Env Sync

Safely sync Codex settings between Windows and macOS while each device stays logged in with its own Codex account. Use either the desktop app, the CLI package, or the transparent scripts.

[中文说明](README.zh-CN.md)

## What This Tool Does

Codex stores local settings under `~/.codex` by default. Some files are useful development preferences, while others are account identity or machine-local state. This project syncs only the safe parts:

- `skills/`
- `prompts/`
- `config.toml`, after removing machine-specific `[projects.*]` entries

It never syncs:

- `auth.json`
- login sessions
- tokens, API keys, credentials, or secrets
- `history.jsonl`
- virtual environments, caches, reports, build outputs, and backups

## Recommended Workflow

This tool supports bidirectional sync. Any computer can upload the latest safe Codex settings, and any other computer can download them.

```text
Computer A: upload safe Codex settings -> commit -> push
Computer B: download remote settings -> install locally -> keep its own codex login
```

Use a simple rule to avoid conflicts: upload from one computer after editing, then download on the other computer before editing there.

## Repository Layout

```text
codex-env-sync/
├── src/
│   ├── core/
│   ├── ui/
│   ├── cli.js
│   └── electron-main.js
├── scripts/
│   ├── windows/
│   │   ├── export-codex-settings.ps1
│   │   ├── install-codex-settings.ps1
│   │   └── check-codex-sync-safety.ps1
│   └── macos/
│       └── install-codex-settings.sh
├── synced/
│   ├── config/
│   ├── skills/
│   └── prompts/
├── examples/
├── tests/
└── README.md
```

## Desktop App

The desktop app gives you three large actions:

- **Upload**: export safe settings, run the safety check, commit `synced/`, and push.
- **Download**: pull remote changes and install `synced/` into the local Codex home.
- **Check Safety**: scan the repository before sharing or installing.

Run from source:

```bash
npm install
npm start
```

Build local packages:

```bash
npm run package:win
npm run package:mac
```

Release builds are produced by `.github/workflows/release.yml` when a version tag such as `v0.2.0` is pushed.

## CLI Package

After publishing to GitHub Packages, users can run:

```bash
npm install -g @hybtc8888/codex-env-sync --registry=https://npm.pkg.github.com
codex-env-sync upload
codex-env-sync download
codex-env-sync check
```

Useful flags:

```bash
codex-env-sync upload --dry-run
codex-env-sync download --dry-run
codex-env-sync upload --repo /path/to/codex-env-sync --codex-home ~/.codex
```

## Windows: Export Settings

Preview first:

```powershell
.\scripts\windows\export-codex-settings.ps1 -DryRun
```

Export:

```powershell
.\scripts\windows\export-codex-settings.ps1
.\scripts\windows\check-codex-sync-safety.ps1
git add synced
git commit -m "sync codex settings"
git push
```

## Windows: Install Settings

Preview first:

```powershell
.\scripts\windows\install-codex-settings.ps1 -DryRun
```

Install:

```powershell
.\scripts\windows\install-codex-settings.ps1
codex login
```

## macOS: Install Settings

Preview first:

```bash
DRY_RUN=1 ./scripts/macos/install-codex-settings.sh
```

Install:

```bash
./scripts/macos/install-codex-settings.sh
codex login
```

## Custom Codex Home

If your Codex home is not `~/.codex`, set `CODEX_HOME`.

Windows:

```powershell
$env:CODEX_HOME = "D:\codex-home"
.\scripts\windows\export-codex-settings.ps1
```

macOS:

```bash
CODEX_HOME="$HOME/.codex-work" ./scripts/macos/install-codex-settings.sh
```

## Safety Model

The scripts use an allowlist approach. They copy only `skills`, `prompts`, and sanitized `config.toml`.

Install scripts back up existing synced targets before replacing them:

- `~/.codex/skills.backup`
- `~/.codex/prompts.backup`
- `~/.codex/config.toml.backup`

Account files such as `auth.json` are not touched. Each machine should run `codex login` independently.

## Tests

Run:

```powershell
.\tests\run.ps1
npm test
```

The tests verify export behavior, install backups, auth preservation, safety checks, shared Node core behavior, and shell syntax when Bash is available.

## License

MIT
