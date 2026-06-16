const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".venv",
  "venv",
  "env",
  "node_modules",
  "__pycache__",
  ".cache",
  "dist",
  "build",
  "reports",
  "outputs",
  "backups",
]);

const EXCLUDED_FILE_NAMES = new Set(["auth.json", "history.jsonl", ".env"]);
const EXCLUDED_FILE_EXTENSIONS = new Set([".pyc", ".pyo", ".log", ".tmp"]);
const FORBIDDEN_NAME_PATTERN = /(token|session|credential|secret)/i;
const SECRET_VALUE_PATTERN = /(sk-[a-z0-9_-]{20,}|xox[baprs]-[a-z0-9-]{20,}|gh[pousr]_[a-z0-9_]{20,})/i;

function getDefaultCodexHome() {
  return process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
}

function getDefaultState(overrides = {}) {
  return {
    repoRoot: overrides.repoRoot || process.cwd(),
    codexHome: overrides.codexHome || getDefaultCodexHome(),
    branch: overrides.branch || "main",
    mode: "bidirectional",
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function removeIfExists(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

function copyFile(source, destination) {
  ensureDir(path.dirname(destination));
  fs.copyFileSync(source, destination);
}

function listFiles(root) {
  if (!fs.existsSync(root)) {
    return [];
  }

  const files = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function shouldExclude(relativePath) {
  const parts = relativePath.split(/[\\/]/);
  const fileName = parts[parts.length - 1];

  if (parts.slice(0, -1).some((part) => EXCLUDED_DIRECTORIES.has(part))) {
    return true;
  }

  if (EXCLUDED_FILE_NAMES.has(fileName)) {
    return true;
  }

  if (FORBIDDEN_NAME_PATTERN.test(fileName)) {
    return true;
  }

  if (EXCLUDED_FILE_EXTENSIONS.has(path.extname(fileName))) {
    return true;
  }

  return false;
}

function copySafeDirectoryContents(source, destination, events, dryRun = false) {
  if (!fs.existsSync(source)) {
    events.push({ level: "info", message: `Skip missing directory: ${source}` });
    return;
  }

  events.push({ level: "info", message: `Export directory: ${source} -> ${destination}` });
  if (dryRun) {
    return;
  }

  if (fs.existsSync(destination)) {
    for (const entry of fs.readdirSync(destination)) {
      if (entry !== ".gitkeep") {
        removeIfExists(path.join(destination, entry));
      }
    }
  } else {
    ensureDir(destination);
  }

  for (const file of listFiles(source)) {
    const relative = path.relative(source, file);
    if (shouldExclude(relative)) {
      continue;
    }
    copyFile(file, path.join(destination, relative));
  }
}

function sanitizeConfig(source, destination, events, dryRun = false) {
  if (!fs.existsSync(source)) {
    events.push({ level: "info", message: `Skip missing file: ${source}` });
    return;
  }

  events.push({ level: "info", message: `Export sanitized config: ${source} -> ${destination}` });
  if (dryRun) {
    return;
  }

  const lines = fs.readFileSync(source, "utf8").split(/\r?\n/);
  const output = [];
  let skipProjectBlock = false;

  for (const line of lines) {
    if (/^\s*\[projects(\.|")/.test(line)) {
      skipProjectBlock = true;
      continue;
    }

    if (skipProjectBlock && /^\s*\[/.test(line)) {
      skipProjectBlock = false;
    }

    if (!skipProjectBlock && line !== "") {
      output.push(line);
    }
  }

  copyText(destination, output.join(os.EOL));
}

function copyText(destination, content) {
  ensureDir(path.dirname(destination));
  fs.writeFileSync(destination, content, "utf8");
}

async function checkSyncSafety(options = {}) {
  const { repoRoot } = getDefaultState(options);
  const violations = [];

  for (const file of listFiles(repoRoot)) {
    const relative = path.relative(repoRoot, file);
    if (relative.split(/[\\/]/).some((part) => EXCLUDED_DIRECTORIES.has(part))) {
      continue;
    }

    const fileName = path.basename(file);
    if (EXCLUDED_FILE_NAMES.has(fileName) || FORBIDDEN_NAME_PATTERN.test(fileName)) {
      violations.push(file);
      continue;
    }

    let content = "";
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (SECRET_VALUE_PATTERN.test(content)) {
      violations.push(file);
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    events: violations.length
      ? [{ level: "error", message: `Safety check failed with ${violations.length} violation(s).` }]
      : [{ level: "success", message: "Safety check passed: no account files or obvious secrets found." }],
  };
}

async function exportCodexSettings(options = {}) {
  const state = getDefaultState(options);
  const events = [
    {
      level: "info",
      message:
        "Protected from export: auth.json, history.jsonl, tokens, sessions, credentials, secrets, virtual environments, caches, and reports.",
    },
  ];
  const syncedRoot = path.join(state.repoRoot, "synced");

  copySafeDirectoryContents(
    path.join(state.codexHome, "skills"),
    path.join(syncedRoot, "skills"),
    events,
    options.dryRun
  );
  copySafeDirectoryContents(
    path.join(state.codexHome, "prompts"),
    path.join(syncedRoot, "prompts"),
    events,
    options.dryRun
  );
  sanitizeConfig(
    path.join(state.codexHome, "config.toml"),
    path.join(syncedRoot, "config", "config.toml"),
    events,
    options.dryRun
  );

  const safety = await checkSyncSafety({ repoRoot: state.repoRoot });
  events.push(...safety.events);
  events.push({ level: safety.ok ? "success" : "error", message: safety.ok ? "Export complete." : "Export blocked." });

  return { ok: safety.ok, events, state };
}

function backupIfExists(targetPath, events, dryRun = false) {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  const backupPath = `${targetPath}.backup`;
  events.push({ level: "info", message: `Backup: ${targetPath} -> ${backupPath}` });
  if (dryRun) {
    return;
  }

  removeIfExists(backupPath);
  fs.renameSync(targetPath, backupPath);
}

function installDirectory(source, destination, events, dryRun = false) {
  if (!fs.existsSync(source)) {
    events.push({ level: "info", message: `Skip missing synced directory: ${source}` });
    return;
  }

  backupIfExists(destination, events, dryRun);
  events.push({ level: "info", message: `Install directory: ${source} -> ${destination}` });
  if (dryRun) {
    return;
  }

  ensureDir(destination);
  for (const entry of fs.readdirSync(source)) {
    if (entry !== ".gitkeep") {
      fs.cpSync(path.join(source, entry), path.join(destination, entry), { recursive: true, force: true });
    }
  }
}

function installFile(source, destination, events, dryRun = false) {
  if (!fs.existsSync(source)) {
    events.push({ level: "info", message: `Skip missing synced file: ${source}` });
    return;
  }

  backupIfExists(destination, events, dryRun);
  events.push({ level: "info", message: `Install file: ${source} -> ${destination}` });
  if (!dryRun) {
    copyFile(source, destination);
  }
}

async function installCodexSettings(options = {}) {
  const state = getDefaultState(options);
  const events = [];
  const safety = await checkSyncSafety({ repoRoot: state.repoRoot });
  events.push(...safety.events);
  if (!safety.ok) {
    return { ok: false, events, state };
  }

  const syncedRoot = path.join(state.repoRoot, "synced");
  if (!options.dryRun) {
    ensureDir(state.codexHome);
  }

  installDirectory(path.join(syncedRoot, "skills"), path.join(state.codexHome, "skills"), events, options.dryRun);
  installDirectory(path.join(syncedRoot, "prompts"), path.join(state.codexHome, "prompts"), events, options.dryRun);
  installFile(path.join(syncedRoot, "config", "config.toml"), path.join(state.codexHome, "config.toml"), events, options.dryRun);
  events.push({ level: "success", message: "Install complete. Run 'codex login' separately on this machine." });

  return { ok: true, events, state };
}

function runGit(args, cwd) {
  return new Promise((resolve) => {
    const child = spawn("git", args, { cwd, shell: process.platform === "win32" });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => resolve({ code, stdout, stderr, command: `git ${args.join(" ")}` }));
  });
}

async function uploadSettings(options = {}) {
  const state = getDefaultState(options);
  const events = [];
  const exported = await exportCodexSettings(options);
  events.push(...exported.events);
  if (!exported.ok || options.dryRun) {
    return { ok: exported.ok, events, state };
  }

  const message = options.message || `sync codex settings from ${os.hostname()}`;
  const commands = [
    ["add", "synced"],
    ["commit", "-m", message],
    ["push"],
  ];

  for (const args of commands) {
    const result = await runGit(args, state.repoRoot);
    const output = `${result.stdout}${result.stderr}`.trim();
    events.push({
      level: result.code === 0 ? "info" : "error",
      message: output || `${result.command} exited with code ${result.code}`,
    });

    if (result.code !== 0) {
      const nothingToCommit = output.includes("nothing to commit") || output.includes("no changes added to commit");
      if (args[0] === "commit" && nothingToCommit) {
        events.push({ level: "info", message: "No local sync changes to commit." });
        continue;
      }
      return { ok: false, events, state };
    }
  }

  events.push({ level: "success", message: "Upload complete." });
  return { ok: true, events, state };
}

async function downloadSettings(options = {}) {
  const state = getDefaultState(options);
  const events = [];
  if (!options.dryRun) {
    const pulled = await runGit(["pull", "--ff-only"], state.repoRoot);
    const output = `${pulled.stdout}${pulled.stderr}`.trim();
    events.push({
      level: pulled.code === 0 ? "info" : "error",
      message: output || `${pulled.command} exited with code ${pulled.code}`,
    });
    if (pulled.code !== 0) {
      return { ok: false, events, state };
    }
  } else {
    events.push({ level: "info", message: "Dry run: skipped git pull." });
  }

  const installed = await installCodexSettings(options);
  events.push(...installed.events);
  events.push({ level: installed.ok ? "success" : "error", message: installed.ok ? "Download complete." : "Download blocked." });
  return { ok: installed.ok, events, state };
}

module.exports = {
  checkSyncSafety,
  downloadSettings,
  exportCodexSettings,
  getDefaultCodexHome,
  getDefaultState,
  installCodexSettings,
  uploadSettings,
};

