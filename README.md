# Codex Env Sync

Safely sync Codex settings between Windows and macOS while each device stays logged in with its own Codex account.

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

Use one computer as the editing source, usually your Windows PC:

```text
Windows PC: export safe Codex settings -> commit -> push
MacBook: pull -> install safe Codex settings -> codex login with its own account
```

## Repository Layout

```text
codex-env-sync/
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
```

The tests verify export behavior, install backups, auth preservation, safety checks, and shell syntax when Bash is available.

## License

MIT

