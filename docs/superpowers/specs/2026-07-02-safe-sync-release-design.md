# Safe Sync Release Design

## Scope

Release v0.4.6 will harden Codex Env Sync around repository selection, download safety, external URL handling, and local asset preservation.

## Decisions

- GitHub App repository selection must only auto-select `codex-env-sync-data`; arbitrary non-source repositories are not valid sync targets.
- GitHub API downloads must stage into a temporary `synced.tmp-*` directory and replace `synced/` only after every blob has been fetched successfully.
- Electron external links must be allowlisted to GitHub HTTPS URLs before calling `shell.openExternal`.
- Installing downloaded `skills` and `prompts` must merge by item instead of replacing whole directories. Local files or skill folders that differ from remote content are preserved, and remote conflicts are saved alongside the local copy.
- Windows release artifacts include the existing portable executable plus a direct-unzip zip package.
- macOS release artifacts include DMG only; macOS zip artifacts are removed.

## Asset Safety

- Local Codex auth files remain excluded and are not touched.
- Existing local skills and prompts are preserved when they conflict with remote content.
- Existing `synced/` content is preserved if GitHub API download fails.
- GitHub tokens remain in memory and are not written to disk.

## Verification

- Unit tests cover repository selection, atomic download rollback, URL allowlisting, and safe merge behavior.
- Release workflow and package scripts reflect the new Windows/macOS artifact set.
- Full verification includes `npm test`, Windows PowerShell tests, safety check, and `npm audit`.
