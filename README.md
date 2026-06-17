# Codex Env Sync

Keep your Codex setup in sync across Windows and macOS without copying logins, sessions, tokens, or machine-specific state.

[中文说明](README.zh-CN.md)

## Why This Exists

Codex gets better as you personalize it: skills, prompts, defaults, and workflow settings slowly become part of how you work. Moving those settings between a desktop PC, a MacBook, and a second account should not mean hunting through hidden folders, copying secret-looking files, or rebuilding the same setup by hand.

Codex Env Sync makes that boring part one-click:

- Connect GitHub once.
- Upload safe Codex settings from one machine.
- Download them on another machine.
- Keep each device signed in with its own Codex account.

It is designed for people who want the convenience of cloud sync with the caution of a local-first developer tool.

## What Makes It Nice

- **One-click desktop flow**: no local Git setup, no Node.js, no npm, no build tools for normal users.
- **Works across PC and Mac**: sync from Windows to macOS, macOS to Windows, or between two Macs.
- **Private by default**: the app creates or selects a private GitHub repository named `codex-env-sync-data`.
- **Account-safe sync**: Codex login files, tokens, sessions, history, caches, and machine state are blocked.
- **GitHub App auth**: users authorize the app in GitHub instead of pasting long personal access tokens.
- **Real progress feedback**: uploads and downloads show steps, elapsed time, and file counts.
- **Bilingual UI and docs**: English and Chinese are included.

## Downloads

Download the latest build from [Releases](https://github.com/hybtc8888/codex-env-sync/releases).

- Windows x64: for most Windows PCs
- Windows arm64: for Windows on ARM devices
- macOS arm64: for Apple Silicon Macs
- macOS x64: for Intel Macs

## Quick Start

1. Download and open the desktop app.
2. Click **Connect GitHub** and authorize the `Codex Env Sync` GitHub App.
3. Click **Upload** on the machine that already has your preferred Codex settings.
4. Open the app on another machine, connect the same GitHub account, and click **Download**.

The app will use a private data repository named:

```text
codex-env-sync-data
```

Keep this separate from the source code repository `codex-env-sync`. If the GitHub App is installed only on the source repository, Codex Env Sync refuses to use it for personal sync data.

## What It Syncs

Codex stores local settings under `~/.codex`. This tool syncs only portable settings:

- `skills/`
- `prompts/`
- sanitized `config.toml`

It never syncs account or machine-local data:

- `auth.json`
- login sessions
- tokens, API keys, credentials, or secrets
- `history.jsonl`
- virtual environments, caches, reports, build outputs, or backups

Each machine should still run `codex login` independently.

## Safety Model

Codex Env Sync uses an allowlist. Files are exported into a temporary synced structure, scanned, and then committed only if they pass the safety checks. Installing remote settings backs up existing local targets first:

- `~/.codex/skills.backup`
- `~/.codex/prompts.backup`
- `~/.codex/config.toml.backup`

The GitHub App authorization lets the desktop app read and write only the repositories where the app is installed. The bundled Client ID is not a secret, and no Client Secret is shipped in the desktop app.

## Developer GitHub App

The public desktop build uses:

```text
https://github.com/apps/codex-env-sync
```

Required GitHub App settings:

- Device Flow: enabled
- Webhook: disabled
- Repository permissions:
  - `Contents: Read and write`
  - `Administration: Read and write` (used to create the private `codex-env-sync-data` repository)
- Account permissions: none
- Events: none
- Installation target: any account

## Local Development

```bash
npm install
npm start
```

Build local packages:

```bash
npm run package:win:x64
npm run package:win:arm64
npm run package:mac
```

## CLI

```bash
codex-env-sync upload --dry-run
codex-env-sync download --dry-run
codex-env-sync upload --repo-url https://github.com/owner/repo.git --github-token TOKEN
codex-env-sync download --repo-url https://github.com/owner/repo.git --github-token TOKEN
```

## Tests

```powershell
.\tests\run.ps1
npm test
```

## License

MIT
