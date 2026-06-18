# Codex Env Sync

Sync your Codex setup across Windows PCs and Macs in minutes, without copying logins, sessions, tokens, or machine-specific state.

[中文说明](README.zh-CN.md)

## Download the Right Version

Get the latest installer from [Releases](https://github.com/hybtc8888/codex-env-sync/releases/tag/v0.4.4).

| Your device | Download this file |
| --- | --- |
| Most Windows PCs with Intel or AMD chips | `Codex.Env.Sync.*-x64.exe` |
| Windows on ARM devices, such as Snapdragon laptops | `Codex.Env.Sync.*-arm64.exe` |
| Apple Silicon Macs, such as M1/M2/M3/M4 MacBook, Mac mini, or iMac | `Codex.Env.Sync-*-arm64.dmg` |
| Older Intel Macs | `Codex.Env.Sync-*.dmg` |

If you are not sure on Windows, choose **x64**. If you are not sure on a modern MacBook, choose **macOS arm64**.

## Why This Exists

Codex gets better as you personalize it: skills, prompts, defaults, and workflow settings slowly become part of how you think and work. But moving that hard-won setup between a desktop PC, a MacBook, and a second account should not mean digging through hidden folders, guessing which files are safe, or rebuilding your workflow by hand like it is 2009.

Codex Env Sync turns your local Codex environment into a portable, account-safe toolkit:

- Connect GitHub once.
- Upload safe Codex settings from one machine.
- Download them on another machine.
- Keep each device signed in with its own Codex account.

It gives Codex users the best part of cloud sync while keeping the dangerous parts firmly out of the sync path. Your setup travels. Your account stays home.

## Why It Feels So Good

- **A real desktop app, not a pile of scripts**: click, authorize, upload, download. Normal users do not need Git, Node.js, npm, Electron, or command-line setup.
- **Cross-platform by design**: Windows to macOS, macOS to Windows, Mac to Mac, PC to PC. Your settings stop caring which machine you are sitting at.
- **Private GitHub storage**: the app creates or selects a private `codex-env-sync-data` repository, so your sync data lives in your own GitHub account.
- **Built for account separation**: Codex login files, tokens, sessions, history, caches, and machine-local state are blocked before they ever reach GitHub.
- **GitHub App authorization**: no long personal access token ceremony for everyday users. GitHub handles the authorization flow.
- **Visible, resilient sync**: uploads and downloads show steps, elapsed time, file counts, retry messages, and completion prompts.
- **Made for real two-device life**: upload on the machine where your setup is best, download on the other, and keep moving.
- **Bilingual from the start**: English and Chinese UI and docs are included.

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
