#!/usr/bin/env node
const path = require("node:path");
const {
  checkSyncSafety,
  downloadSettings,
  exportCodexSettings,
  installCodexSettings,
  uploadSettings,
} = require("./core/sync");

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--repo") {
      args.repoRoot = path.resolve(argv[++i]);
    } else if (arg === "--codex-home") {
      args.codexHome = path.resolve(argv[++i]);
    } else if (arg === "--message") {
      args.message = argv[++i];
    } else {
      args._.push(arg);
    }
  }
  return args;
}

function printEvents(events) {
  for (const event of events) {
    const label = event.level === "success" ? "OK" : event.level === "error" ? "ERR" : "INFO";
    console.log(`[${label}] ${event.message}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || "help";
  let result;

  if (command === "upload") {
    result = await uploadSettings(args);
  } else if (command === "download") {
    result = await downloadSettings(args);
  } else if (command === "export") {
    result = await exportCodexSettings(args);
  } else if (command === "install") {
    result = await installCodexSettings(args);
  } else if (command === "check") {
    result = await checkSyncSafety(args);
  } else {
    console.log(`Codex Env Sync

Usage:
  codex-env-sync upload [--dry-run] [--repo PATH] [--codex-home PATH]
  codex-env-sync download [--dry-run] [--repo PATH] [--codex-home PATH]
  codex-env-sync check [--repo PATH]

Upload exports safe Codex settings, commits synced/, and pushes.
Download pulls remote changes, installs synced settings, and preserves local auth.`);
    return;
  }

  printEvents(result.events || []);
  process.exitCode = result.ok ? 0 : 1;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

