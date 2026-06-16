const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  exportCodexSettings,
  installCodexSettings,
  checkSyncSafety,
  checkUploadReadiness,
  configureRepository,
  parseGitHubRepo,
  getDefaultState,
} = require("../src/core/sync");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "codex-env-sync-js-"));
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("exportCodexSettings copies safe assets and removes machine project config", async () => {
  const codexHome = makeTempDir();
  const repoRoot = makeTempDir();

  writeFile(path.join(codexHome, "skills/demo/SKILL.md"), "skill-body");
  writeFile(path.join(codexHome, "skills/demo/.venv/pkg/session.py"), "runtime-cache");
  writeFile(path.join(codexHome, "prompts/base.md"), "prompt-body");
  writeFile(path.join(codexHome, "auth.json"), "{}");
  writeFile(
    path.join(codexHome, "config.toml"),
    'model = "test"\n[projects."C:\\\\tmp"]\ntrusted = true\n'
  );

  const result = await exportCodexSettings({ codexHome, repoRoot });

  assert.equal(result.ok, true);
  assert.equal(readFile(path.join(repoRoot, "synced/skills/demo/SKILL.md")), "skill-body");
  assert.equal(readFile(path.join(repoRoot, "synced/prompts/base.md")), "prompt-body");
  assert.equal(readFile(path.join(repoRoot, "synced/config/config.toml")), 'model = "test"');
  assert.equal(fs.existsSync(path.join(repoRoot, "synced/auth.json")), false);
  assert.equal(fs.existsSync(path.join(repoRoot, "synced/skills/demo/.venv")), false);
});

test("installCodexSettings installs synced assets and preserves local auth", async () => {
  const codexHome = makeTempDir();
  const repoRoot = makeTempDir();

  writeFile(path.join(repoRoot, "synced/skills/demo/SKILL.md"), "new-skill");
  writeFile(path.join(repoRoot, "synced/prompts/base.md"), "new-prompt");
  writeFile(path.join(repoRoot, "synced/config/config.toml"), 'model = "new"');
  writeFile(path.join(codexHome, "skills/old/SKILL.md"), "old-skill");
  writeFile(path.join(codexHome, "auth.json"), "local-auth");

  const result = await installCodexSettings({ codexHome, repoRoot });

  assert.equal(result.ok, true);
  assert.equal(readFile(path.join(codexHome, "skills/demo/SKILL.md")), "new-skill");
  assert.equal(readFile(path.join(codexHome, "prompts/base.md")), "new-prompt");
  assert.equal(readFile(path.join(codexHome, "config.toml")), 'model = "new"');
  assert.equal(readFile(path.join(codexHome, "skills.backup/old/SKILL.md")), "old-skill");
  assert.equal(readFile(path.join(codexHome, "auth.json")), "local-auth");
});

test("checkSyncSafety rejects account files in synced content", async () => {
  const repoRoot = makeTempDir();
  writeFile(path.join(repoRoot, "synced/auth.json"), "{}");

  const result = await checkSyncSafety({ repoRoot });

  assert.equal(result.ok, false);
  assert.equal(result.violations.some((item) => item.endsWith("auth.json")), true);
});

test("exportCodexSettings blocks unsafe config keys before sync", async () => {
  const codexHome = makeTempDir();
  const repoRoot = makeTempDir();

  writeFile(path.join(codexHome, "config.toml"), 'model = "test"\napi_key = "plain-secret-value"\n');

  const result = await exportCodexSettings({ codexHome, repoRoot });

  assert.equal(result.ok, false);
  assert.equal(result.events.some((event) => event.message.includes("Unsafe config key")), true);
  assert.equal(fs.existsSync(path.join(repoRoot, "synced/config/config.toml")), false);
});

test("checkUploadReadiness blocks upload when local branch is behind upstream", async () => {
  const commands = [];
  const fakeGitRunner = async (args) => {
    commands.push(args.join(" "));
    if (args[0] === "rev-parse") return { code: 0, stdout: "true\n", stderr: "", command: "git rev-parse" };
    if (args[0] === "status") return { code: 0, stdout: "", stderr: "", command: "git status" };
    if (args[0] === "fetch") return { code: 0, stdout: "", stderr: "", command: "git fetch" };
    if (args[0] === "rev-list") return { code: 0, stdout: "0\t2\n", stderr: "", command: "git rev-list" };
    return { code: 1, stdout: "", stderr: "unexpected", command: `git ${args.join(" ")}` };
  };

  const result = await checkUploadReadiness({ repoRoot: makeTempDir(), gitRunner: fakeGitRunner });

  assert.equal(result.ok, false);
  assert.equal(result.events.some((event) => event.message.includes("behind")), true);
  assert.deepEqual(commands, ["rev-parse --is-inside-work-tree", "status --porcelain", "fetch", "rev-list --left-right --count HEAD...@{u}"]);
});

test("configureRepository prepares an existing repo remote and local author", async () => {
  const repoRoot = makeTempDir();
  const commands = [];
  const fakeGitRunner = async (args) => {
    commands.push(args.join(" "));
    if (args[0] === "rev-parse") return { code: 0, stdout: "true\n", stderr: "", command: "git rev-parse" };
    if (args[0] === "remote" && args[1] === "get-url") return { code: 1, stdout: "", stderr: "missing", command: "git remote get-url origin" };
    return { code: 0, stdout: "", stderr: "", command: `git ${args.join(" ")}` };
  };

  const result = await configureRepository({
    repoRoot,
    repoUrl: "https://github.com/example/codex-env-sync.git",
    gitName: "Example User",
    gitEmail: "example@example.com",
    gitRunner: fakeGitRunner,
  });

  assert.equal(result.ok, true);
  assert.equal(commands.includes("remote add origin https://github.com/example/codex-env-sync.git"), true);
  assert.equal(commands.includes("config user.name Example User"), true);
  assert.equal(commands.includes("config user.email example@example.com"), true);
});

test("parseGitHubRepo accepts common GitHub URL formats", () => {
  assert.deepEqual(parseGitHubRepo("https://github.com/example/codex-env-sync.git"), {
    owner: "example",
    repo: "codex-env-sync",
  });
  assert.deepEqual(parseGitHubRepo("git@github.com:example/codex-env-sync.git"), {
    owner: "example",
    repo: "codex-env-sync",
  });
  assert.deepEqual(parseGitHubRepo("example/codex-env-sync"), {
    owner: "example",
    repo: "codex-env-sync",
  });
});

test("getDefaultState creates user-facing defaults", () => {
  const state = getDefaultState({ repoRoot: "C:\\repo", codexHome: "C:\\codex" });

  assert.equal(state.repoRoot, "C:\\repo");
  assert.equal(state.codexHome, "C:\\codex");
  assert.equal(state.branch, "main");
  assert.equal(state.mode, "bidirectional");
});
