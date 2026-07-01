#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
DRY_RUN="${DRY_RUN:-0}"

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' "Node.js is required to install Codex settings with safe merge." >&2
  exit 1
fi

args=(install --repo "$REPO_ROOT" --codex-home "$CODEX_HOME")
if [ "$DRY_RUN" = "1" ]; then
  args+=(--dry-run)
fi

node "$REPO_ROOT/src/cli.js" "${args[@]}"
