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
  "release",
  "reports",
  "outputs",
  "backups",
]);

const EXCLUDED_FILE_NAMES = new Set(["auth.json", "history.jsonl", ".env"]);
const EXCLUDED_FILE_EXTENSIONS = new Set([".pyc", ".pyo", ".log", ".tmp"]);
const FORBIDDEN_NAME_PATTERN = /(token|session|credential|secret)/i;
const SECRET_VALUE_PATTERN = /(sk-[a-z0-9_-]{20,}|xox[baprs]-[a-z0-9-]{20,}|gh[pousr]_[a-z0-9_]{20,})/i;
const UNSAFE_CONFIG_KEY_PATTERN = /^\s*([A-Za-z0-9_.-]*(api[_-]?key|token|secret|password|credential)[A-Za-z0-9_.-]*)\s*=/i;
const SOURCE_REPOSITORY_NAME = "codex-env-sync";
const DEFAULT_SYNC_REPOSITORY_NAME = "codex-env-sync-data";

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

function parseGitHubRepo(repoUrl = "") {
  const value = repoUrl.trim();
  const patterns = [
    /^https:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/i,
    /^git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?$/i,
    /^([^/\s]+)\/([^/\s.]+)$/i,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  }

  throw new Error("Use a GitHub repository URL such as https://github.com/owner/repo.git.");
}

function checkSyncRepositoryUrl(repoUrl) {
  if (!repoUrl) {
    return { ok: true };
  }

  const { repo } = parseGitHubRepo(repoUrl);
  if (repo.toLowerCase() === SOURCE_REPOSITORY_NAME) {
    return {
      ok: false,
      event: {
        level: "error",
        message: `The repository ${SOURCE_REPOSITORY_NAME} is the source code repository. Use a private ${DEFAULT_SYNC_REPOSITORY_NAME} repository for synced data.`,
      },
    };
  }

  return { ok: true };
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

function listLocalSyncedFiles(repoRoot) {
  const syncedRoot = path.join(repoRoot, "synced");
  return listFiles(syncedRoot)
    .filter((file) => path.basename(file) !== ".gitkeep")
    .map((file) => ({
      absolute: file,
      githubPath: path.posix.join("synced", path.relative(syncedRoot, file).split(path.sep).join("/")),
    }));
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
  const unsafeKeys = [];
  let skipProjectBlock = false;

  for (const line of lines) {
    const unsafeKey = line.match(UNSAFE_CONFIG_KEY_PATTERN);
    if (unsafeKey) {
      unsafeKeys.push(unsafeKey[1]);
      continue;
    }

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

  if (unsafeKeys.length > 0) {
    events.push({
      level: "error",
      message: `Unsafe config key(s) blocked: ${unsafeKeys.join(", ")}`,
    });
    return false;
  }

  copyText(destination, output.join(os.EOL));
  return true;
}

function copyText(destination, content) {
  ensureDir(path.dirname(destination));
  fs.writeFileSync(destination, content, "utf8");
}

function emitProgress(options, progress) {
  if (typeof options.onProgress === "function") {
    options.onProgress(progress);
  }
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
  emitProgress(options, { kind: "upload", phase: "export", message: "Exporting safe Codex settings." });
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
  const configOk = sanitizeConfig(
    path.join(state.codexHome, "config.toml"),
    path.join(syncedRoot, "config", "config.toml"),
    events,
    options.dryRun
  );

  if (configOk === false) {
    events.push({ level: "error", message: "Export blocked." });
    return { ok: false, events, state };
  }

  const safety = await checkSyncSafety({ repoRoot: state.repoRoot });
  events.push(...safety.events);
  events.push({ level: safety.ok ? "success" : "error", message: safety.ok ? "Export complete." : "Export blocked." });
  const exportedFiles = listLocalSyncedFiles(state.repoRoot).length;
  emitProgress(options, { kind: "upload", phase: "export", current: exportedFiles, total: exportedFiles, message: "Exported safe Codex settings." });

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

  events.push({ level: "info", message: `Install directory: ${source} -> ${destination}` });
  if (dryRun) {
    return;
  }

  const tempDestination = `${destination}.tmp-${process.pid}`;
  const backupPath = `${destination}.backup`;

  removeIfExists(tempDestination);
  ensureDir(tempDestination);

  try {
    for (const entry of fs.readdirSync(source)) {
      if (entry !== ".gitkeep") {
        fs.cpSync(path.join(source, entry), path.join(tempDestination, entry), { recursive: true, force: true });
      }
    }

    if (fs.existsSync(destination)) {
      events.push({ level: "info", message: `Backup: ${destination} -> ${backupPath}` });
      removeIfExists(backupPath);
      fs.renameSync(destination, backupPath);
    }
    fs.renameSync(tempDestination, destination);
  } catch (error) {
    removeIfExists(tempDestination);
    if (!fs.existsSync(destination) && fs.existsSync(backupPath)) {
      fs.renameSync(backupPath, destination);
    }
    throw error;
  }
}

function installFile(source, destination, events, dryRun = false) {
  if (!fs.existsSync(source)) {
    events.push({ level: "info", message: `Skip missing synced file: ${source}` });
    return;
  }

  events.push({ level: "info", message: `Install file: ${source} -> ${destination}` });
  if (dryRun) {
    return;
  }

  const tempDestination = `${destination}.tmp-${process.pid}`;
  const backupPath = `${destination}.backup`;

  try {
    copyFile(source, tempDestination);
    if (fs.existsSync(destination)) {
      events.push({ level: "info", message: `Backup: ${destination} -> ${backupPath}` });
      removeIfExists(backupPath);
      fs.renameSync(destination, backupPath);
    }
    fs.renameSync(tempDestination, destination);
  } catch (error) {
    removeIfExists(tempDestination);
    if (!fs.existsSync(destination) && fs.existsSync(backupPath)) {
      fs.renameSync(backupPath, destination);
    }
    throw error;
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

async function githubRequest(options, apiPath, init = {}) {
  const token = options.githubToken || process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GitHub token is required for dependency-free GitHub API sync.");
  }

  const response = await (options.fetch || fetch)(`https://api.github.com${apiPath}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.message || `GitHub API request failed: ${response.status}`);
  }
  return data;
}

async function uploadSyncedViaGitHub(options = {}) {
  const state = getDefaultState(options);
  const { owner, repo } = parseGitHubRepo(options.repoUrl);
  const branch = options.branch || state.branch;
  const events = [];

  const ref = await githubRequest(options, `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
  const headCommit = await githubRequest(options, `/repos/${owner}/${repo}/git/commits/${ref.object.sha}`);
  const remoteTree = await githubRequest(options, `/repos/${owner}/${repo}/git/trees/${headCommit.tree.sha}?recursive=1`);
  const localFiles = listLocalSyncedFiles(state.repoRoot);
  const localPaths = new Set(localFiles.map((file) => file.githubPath));
  emitProgress(options, { kind: "upload", phase: "upload", current: 0, total: localFiles.length, message: "Uploading files to GitHub." });

  const tree = [];
  let uploadedCount = 0;
  for (const file of localFiles) {
    const blob = await githubRequest(options, `/repos/${owner}/${repo}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({
        content: fs.readFileSync(file.absolute, "base64"),
        encoding: "base64",
      }),
    });
    tree.push({ path: file.githubPath, mode: "100644", type: "blob", sha: blob.sha });
    uploadedCount += 1;
    emitProgress(options, {
      kind: "upload",
      phase: "upload",
      current: uploadedCount,
      total: localFiles.length,
      file: file.githubPath,
      message: "Uploading files to GitHub.",
    });
  }

  emitProgress(options, { kind: "upload", phase: "commit", current: uploadedCount, total: localFiles.length, message: "Finalizing GitHub commit." });
  for (const item of remoteTree.tree || []) {
    if (item.type === "blob" && item.path.startsWith("synced/") && !localPaths.has(item.path)) {
      tree.push({ path: item.path, mode: "100644", type: "blob", sha: null });
    }
  }

  const newTree = await githubRequest(options, `/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: headCommit.tree.sha, tree }),
  });
  const commit = await githubRequest(options, `/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: options.message || `sync codex settings from ${os.hostname()}`,
      tree: newTree.sha,
      parents: [ref.object.sha],
    }),
  });
  await githubRequest(options, `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha }),
  });

  emitProgress(options, { kind: "upload", phase: "complete", current: localFiles.length, total: localFiles.length, message: "Upload complete." });
  events.push({ level: "success", message: `Uploaded synced settings to ${owner}/${repo}@${branch} without requiring local Git.` });
  return { ok: true, events, state };
}

async function downloadSyncedViaGitHub(options = {}) {
  const state = getDefaultState(options);
  const { owner, repo } = parseGitHubRepo(options.repoUrl);
  const branch = options.branch || state.branch;
  const events = [];
  const syncedRoot = path.join(state.repoRoot, "synced");

  const ref = await githubRequest(options, `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
  const headCommit = await githubRequest(options, `/repos/${owner}/${repo}/git/commits/${ref.object.sha}`);
  const remoteTree = await githubRequest(options, `/repos/${owner}/${repo}/git/trees/${headCommit.tree.sha}?recursive=1`);
  const syncedFiles = (remoteTree.tree || []).filter((item) => item.type === "blob" && item.path.startsWith("synced/") && !item.path.endsWith(".gitkeep"));
  emitProgress(options, { kind: "download", phase: "download", current: 0, total: syncedFiles.length, message: "Downloading files from GitHub." });

  removeIfExists(syncedRoot);
  ensureDir(path.join(syncedRoot, "config"));
  ensureDir(path.join(syncedRoot, "skills"));
  ensureDir(path.join(syncedRoot, "prompts"));
  copyText(path.join(syncedRoot, "config", ".gitkeep"), "");
  copyText(path.join(syncedRoot, "skills", ".gitkeep"), "");
  copyText(path.join(syncedRoot, "prompts", ".gitkeep"), "");

  let downloadedCount = 0;
  for (const item of syncedFiles) {
    const blob = await githubRequest(options, `/repos/${owner}/${repo}/git/blobs/${item.sha}`);
    copyFileFromBuffer(path.join(state.repoRoot, item.path), Buffer.from(blob.content.replace(/\s/g, ""), "base64"));
    downloadedCount += 1;
    emitProgress(options, {
      kind: "download",
      phase: "download",
      current: downloadedCount,
      total: syncedFiles.length,
      file: item.path,
      message: "Downloading files from GitHub.",
    });
  }

  emitProgress(options, { kind: "download", phase: "complete", current: syncedFiles.length, total: syncedFiles.length, message: "Download complete." });
  events.push({ level: "success", message: `Downloaded synced settings from ${owner}/${repo}@${branch} without requiring local Git.` });
  return { ok: true, events, state };
}

function copyFileFromBuffer(destination, buffer) {
  ensureDir(path.dirname(destination));
  fs.writeFileSync(destination, buffer);
}

async function callGit(options, args, cwd) {
  if (options.gitRunner) {
    return options.gitRunner(args, cwd);
  }
  return runGit(args, cwd);
}

async function checkUploadReadiness(options = {}) {
  const state = getDefaultState(options);
  const events = [];

  const inRepo = await callGit(options, ["rev-parse", "--is-inside-work-tree"], state.repoRoot);
  if (inRepo.code !== 0) {
    return {
      ok: false,
      events: [{ level: "error", message: "Repository folder is not a Git repository. Run setup first." }],
      state,
    };
  }

  const status = await callGit(options, ["status", "--porcelain"], state.repoRoot);
  if (status.code !== 0) {
    return { ok: false, events: [{ level: "error", message: status.stderr || "Unable to read Git status." }], state };
  }
  if (status.stdout.trim()) {
    return {
      ok: false,
      events: [{ level: "error", message: "Working tree has unsaved changes outside the sync flow. Commit, stash, or reset them first." }],
      state,
    };
  }

  const fetched = await callGit(options, ["fetch"], state.repoRoot);
  if (fetched.code !== 0) {
    events.push({ level: "info", message: "No upstream fetch available yet; continuing with local upload." });
    return { ok: true, events, state };
  }

  const divergence = await callGit(options, ["rev-list", "--left-right", "--count", "HEAD...@{u}"], state.repoRoot);
  if (divergence.code !== 0) {
    events.push({ level: "info", message: "No upstream branch configured yet; continuing with local upload." });
    return { ok: true, events, state };
  }

  const [aheadText, behindText] = divergence.stdout.trim().split(/\s+/);
  const ahead = Number(aheadText || 0);
  const behind = Number(behindText || 0);
  if (behind > 0) {
    return {
      ok: false,
      events: [{ level: "error", message: `Local branch is behind upstream by ${behind} commit(s). Download first, then upload.` }],
      state,
    };
  }

  events.push({ level: "success", message: `Upload preflight passed${ahead > 0 ? ` with ${ahead} local commit(s) ahead` : ""}.` });
  return { ok: true, events, state };
}

async function configureRepository(options = {}) {
  const state = getDefaultState(options);
  const events = [];

  if (!options.repoUrl) {
    return { ok: false, events: [{ level: "error", message: "Repository URL is required." }], state };
  }

  if (!fs.existsSync(state.repoRoot)) {
    ensureDir(path.dirname(state.repoRoot));
    const cloned = await callGit(options, ["clone", options.repoUrl, state.repoRoot], path.dirname(state.repoRoot));
    events.push({ level: cloned.code === 0 ? "info" : "error", message: (cloned.stdout + cloned.stderr).trim() || cloned.command });
    if (cloned.code !== 0) {
      return { ok: false, events, state };
    }
  }

  const inRepo = await callGit(options, ["rev-parse", "--is-inside-work-tree"], state.repoRoot);
  if (inRepo.code !== 0) {
    const initialized = await callGit(options, ["init"], state.repoRoot);
    events.push({ level: initialized.code === 0 ? "info" : "error", message: (initialized.stdout + initialized.stderr).trim() || initialized.command });
    if (initialized.code !== 0) {
      return { ok: false, events, state };
    }
  }

  const remote = await callGit(options, ["remote", "get-url", "origin"], state.repoRoot);
  const remoteArgs = remote.code === 0 ? ["remote", "set-url", "origin", options.repoUrl] : ["remote", "add", "origin", options.repoUrl];
  const remoteResult = await callGit(options, remoteArgs, state.repoRoot);
  events.push({ level: remoteResult.code === 0 ? "info" : "error", message: (remoteResult.stdout + remoteResult.stderr).trim() || `git ${remoteArgs.join(" ")}` });
  if (remoteResult.code !== 0) {
    return { ok: false, events, state };
  }

  if (options.gitName) {
    const nameResult = await callGit(options, ["config", "user.name", options.gitName], state.repoRoot);
    if (nameResult.code !== 0) return { ok: false, events: [{ level: "error", message: nameResult.stderr || "Unable to set Git user.name." }], state };
  }
  if (options.gitEmail) {
    const emailResult = await callGit(options, ["config", "user.email", options.gitEmail], state.repoRoot);
    if (emailResult.code !== 0) return { ok: false, events: [{ level: "error", message: emailResult.stderr || "Unable to set Git user.email." }], state };
  }

  events.push({ level: "success", message: "Repository setup complete." });
  return { ok: true, events, state };
}

async function uploadSettings(options = {}) {
  const state = getDefaultState(options);
  const events = [];
  const repositoryCheck = checkSyncRepositoryUrl(options.repoUrl);
  if (!repositoryCheck.ok) {
    return { ok: false, events: [repositoryCheck.event], state };
  }

  if (options.githubToken && options.repoUrl) {
    const exported = await exportCodexSettings(options);
    events.push(...exported.events);
    if (!exported.ok || options.dryRun) {
      return { ok: exported.ok, events, state };
    }
    const uploaded = await uploadSyncedViaGitHub(options);
    events.push(...uploaded.events);
    return { ok: uploaded.ok, events, state };
  }

  const readiness = await checkUploadReadiness(options);
  events.push(...readiness.events);
  if (!readiness.ok) {
    return { ok: false, events, state };
  }

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
    const result = await callGit(options, args, state.repoRoot);
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
  const repositoryCheck = checkSyncRepositoryUrl(options.repoUrl);
  if (!repositoryCheck.ok) {
    return { ok: false, events: [repositoryCheck.event], state };
  }

  if (options.githubToken && options.repoUrl) {
    if (options.dryRun) {
      events.push({ level: "info", message: "Dry run: skipped GitHub API download." });
    } else {
      const downloaded = await downloadSyncedViaGitHub(options);
      events.push(...downloaded.events);
    }
    const installed = await installCodexSettings(options);
    events.push(...installed.events);
    events.push({ level: installed.ok ? "success" : "error", message: installed.ok ? "Download complete." : "Download blocked." });
    return { ok: installed.ok, events, state };
  }

  if (!options.dryRun) {
    const pulled = await callGit(options, ["pull", "--ff-only"], state.repoRoot);
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
  checkUploadReadiness,
  configureRepository,
  downloadSettings,
  exportCodexSettings,
  getDefaultCodexHome,
  getDefaultState,
  installCodexSettings,
  checkSyncRepositoryUrl,
  parseGitHubRepo,
  uploadSyncedViaGitHub,
  uploadSettings,
};
