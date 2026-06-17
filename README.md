# Codex Env Sync

Safely sync Codex settings between Windows and macOS while each device keeps its own Codex login.

[中文说明](README.zh-CN.md)

## What It Syncs

Codex stores local settings under `~/.codex`. This tool syncs only safe, portable settings:

- `skills/`
- `prompts/`
- sanitized `config.toml`

It never syncs account or machine-local data:

- `auth.json`
- login sessions
- tokens, API keys, credentials, or secrets
- `history.jsonl`
- virtual environments, caches, reports, build outputs, or backups

## Desktop App

Most users do not need Node.js, npm, Electron, Git, or build tools. Download the Windows `.exe` or macOS `.dmg` from [Releases](https://github.com/hybtc8888/codex-env-sync/releases).

The main flow is intentionally small:

1. Create a private GitHub repository named `codex-env-sync-data`.
2. Install the `Codex Env Sync` GitHub App on that private data repository.
3. Click **Connect GitHub** in the desktop app.
4. Click **Upload** on one machine.
5. Click **Download** on another machine.

The GitHub App authorization lets the desktop app read and write only the repository where synced settings are stored. It avoids local Git setup and makes PC/Mac sync one-click. The access token is used only in the current app window and is not written to the repository.

By default, the app looks for a user data repository named:

```text
codex-env-sync-data
```

Keep this separate from the source code repository `codex-env-sync`. If the app is installed only on the source repository, the desktop app will refuse to sync and ask you to choose a private data repository instead.

Advanced settings still allow manual repository URL, token, Git identity, repository folder, Codex home, commit message, and preview-only runs.

## Developer GitHub App

The public desktop build uses this GitHub App:

```text
https://github.com/apps/codex-env-sync
```

The bundled Client ID is not a secret. Do not bundle a Client Secret in the desktop app.

Required GitHub App settings:

- Device Flow: enabled
- Webhook: disabled
- Repository permissions:
  - `Contents: Read and write`
  - `Administration: Read and write` (only used to create the private `codex-env-sync-data` repository)
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
npm run package:win
npm run package:mac
```

## CLI

```bash
codex-env-sync upload --dry-run
codex-env-sync download --dry-run
codex-env-sync upload --repo-url https://github.com/owner/repo.git --github-token TOKEN
codex-env-sync download --repo-url https://github.com/owner/repo.git --github-token TOKEN
```

## Safety Model

The implementation uses an allowlist. It copies only `skills`, `prompts`, and sanitized `config.toml`.

Installing remote settings backs up existing local targets first:

- `~/.codex/skills.backup`
- `~/.codex/prompts.backup`
- `~/.codex/config.toml.backup`

Each machine should still run `codex login` independently.

## Tests

```powershell
.\tests\run.ps1
npm test
```

## License

MIT
