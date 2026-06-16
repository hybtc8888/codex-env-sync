#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SYNCED_ROOT="${REPO_ROOT}/synced"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
DRY_RUN="${DRY_RUN:-0}"

say() {
  printf '%s\n' "$1"
}

verify_repo() {
  if find "$REPO_ROOT" \
    \( -name 'auth.json' -o -name '.env' -o -iname '*token*' -o -iname '*session*' -o -iname '*credential*' -o -iname '*secret*' \) \
    -not -path '*/.git/*' \
    -not -path '*/backups/*' \
    -not -path '*/node_modules/*' \
    -not -path '*/.venv/*' \
    -not -path '*/venv/*' \
    -not -path '*/env/*' \
    -not -path '*/__pycache__/*' \
    -not -path '*/.cache/*' \
    -not -path '*/dist/*' \
    -not -path '*/build/*' \
    -not -path '*/release/*' \
    -not -path '*/reports/*' \
    -not -path '*/outputs/*' | grep -q .; then
    say "Unsafe account-bound files found. Remove them before installing."
    exit 1
  fi

  if grep -RIE '(sk-[a-z0-9_-]{20,}|xox[baprs]-[a-z0-9-]{20,}|gh[pousr]_[a-z0-9_]{20,})' "$REPO_ROOT" \
    --exclude-dir=.git \
    --exclude-dir=backups \
    --exclude-dir=node_modules \
    --exclude-dir=.venv \
    --exclude-dir=venv \
    --exclude-dir=env \
    --exclude-dir=__pycache__ \
    --exclude-dir=.cache \
    --exclude-dir=dist \
    --exclude-dir=build \
    --exclude-dir=release \
    --exclude-dir=reports \
    --exclude-dir=outputs >/dev/null 2>&1; then
    say "Secret-looking values found. Remove them before installing."
    exit 1
  fi

  if [ -f "$SYNCED_ROOT/config/config.toml" ] && grep -Eiq '^[[:space:]]*[A-Za-z0-9_.-]*(api[_-]?key|token|secret|password|credential)[A-Za-z0-9_.-]*[[:space:]]*=' "$SYNCED_ROOT/config/config.toml"; then
    say "Unsafe config key found in synced/config/config.toml. Remove account-bound values before installing."
    exit 1
  fi
}

backup_if_exists() {
  path="$1"
  if [ ! -e "$path" ]; then
    return
  fi

  say "Backup: $path -> $path.backup"
  if [ "$DRY_RUN" = "1" ]; then
    return
  fi

  rm -rf "$path.backup"
  mv "$path" "$path.backup"
}

install_dir() {
  src="$1"
  dest="$2"

  if [ ! -d "$src" ]; then
    say "Skip missing synced directory: $src"
    return
  fi

  backup_if_exists "$dest"
  say "Install directory: $src -> $dest"
  if [ "$DRY_RUN" = "1" ]; then
    return
  fi

  mkdir -p "$dest"
  find "$src" -mindepth 1 -maxdepth 1 ! -name '.gitkeep' -exec cp -R {} "$dest"/ \;
}

install_file() {
  src="$1"
  dest="$2"

  if [ ! -f "$src" ]; then
    say "Skip missing synced file: $src"
    return
  fi

  backup_if_exists "$dest"
  say "Install file: $src -> $dest"
  if [ "$DRY_RUN" = "1" ]; then
    return
  fi

  mkdir -p "$(dirname "$dest")"
  cp "$src" "$dest"
}

verify_repo

if [ "$DRY_RUN" != "1" ]; then
  mkdir -p "$CODEX_HOME"
fi

install_dir "$SYNCED_ROOT/skills" "$CODEX_HOME/skills"
install_dir "$SYNCED_ROOT/prompts" "$CODEX_HOME/prompts"
install_file "$SYNCED_ROOT/config/config.toml" "$CODEX_HOME/config.toml"

say "Install complete. Run 'codex login' separately on this Mac."
