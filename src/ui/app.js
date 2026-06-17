const repoRootInput = document.querySelector("#repo-root");
const languageSelect = document.querySelector("#language-select");
const repoUrlInput = document.querySelector("#repo-url");
const githubTokenInput = document.querySelector("#github-token");
const connectGitHubButton = document.querySelector("#connect-github-button");
const githubUserCode = document.querySelector("#github-user-code");
const githubAuthCopy = document.querySelector("#github-auth-copy");
const authDialog = document.querySelector("#auth-dialog");
const authDialogCode = document.querySelector("#auth-dialog-code");
const authDialogCopy = document.querySelector("#auth-dialog-copy");
const copyAuthCodeButton = document.querySelector("#copy-auth-code-button");
const closeAuthDialogButton = document.querySelector("#close-auth-dialog-button");
const completeDialog = document.querySelector("#complete-dialog");
const completeDialogEyebrow = document.querySelector("#complete-dialog-eyebrow");
const completeDialogTitle = document.querySelector("#complete-dialog-title");
const completeDialogCopy = document.querySelector("#complete-dialog-copy");
const starGitHubButton = document.querySelector("#star-github-button");
const closeCompleteDialogButton = document.querySelector("#close-complete-dialog-button");
const gitNameInput = document.querySelector("#git-name");
const gitEmailInput = document.querySelector("#git-email");
const codexHomeInput = document.querySelector("#codex-home");
const messageInput = document.querySelector("#commit-message");
const dryRunInput = document.querySelector("#dry-run");
const statusDot = document.querySelector("#status-dot");
const statusTitle = document.querySelector("#status-title");
const statusCopy = document.querySelector("#status-copy");
const logList = document.querySelector("#log-list");
const progressCurrent = document.querySelector("#progress-current");
const progressElapsed = document.querySelector("#progress-elapsed");
const progressFiles = document.querySelector("#progress-files");
const progressBarFill = document.querySelector("#progress-bar-fill");
const actionButtons = Array.from(document.querySelectorAll(".action"));

const STORAGE_KEY = "codex-env-sync-settings";
const LANGUAGE_KEY = "codex-env-sync-language";
let currentLanguage = window.CodexEnvSyncI18n.normalizeLanguage(localStorage.getItem(LANGUAGE_KEY) || navigator.language);
let t = window.CodexEnvSyncI18n.createTranslator(currentLanguage);
let currentAuthSessionId = "";
let authFinished = false;
let currentGitHubLogin = "";
let currentGitHubAuthStatus = "";
let operationStartedAt = 0;
let operationTimer = null;
const GITHUB_REPO_URL = "https://github.com/hybtc8888/codex-env-sync";

function loadSavedSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveSettings() {
  const value = {
    repoRoot: repoRootInput.value.trim(),
    repoUrl: repoUrlInput.value.trim(),
    gitName: gitNameInput.value.trim(),
    gitEmail: gitEmailInput.value.trim(),
    githubLogin: currentGitHubLogin,
    githubAuthStatus: currentGitHubAuthStatus,
    codexHome: codexHomeInput.value.trim(),
    message: messageInput.value.trim(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function hasTrustedSavedGitHubIdentity(saved = {}) {
  return saved.githubAuthStatus === "connected" && Boolean(saved.githubLogin);
}

function clearGitHubIdentityFields(status = "pending") {
  githubTokenInput.value = "";
  gitNameInput.value = "";
  gitEmailInput.value = "";
  currentGitHubLogin = "";
  currentGitHubAuthStatus = status;
}

function applyConnectedGitHubSettings(completed = {}) {
  const user = completed.user || {};
  currentGitHubLogin = user.login || "";
  currentGitHubAuthStatus = currentGitHubLogin ? "connected" : "";
  githubTokenInput.value = completed.githubToken || "";
  gitNameInput.value = user.gitName || "";
  gitEmailInput.value = user.gitEmail || "";
  if (completed.repository) {
    repoUrlInput.value = completed.repository.cloneUrl || repoUrlInput.value;
  }
}

function applyLanguage(language) {
  currentLanguage = window.CodexEnvSyncI18n.normalizeLanguage(language);
  t = window.CodexEnvSyncI18n.createTranslator(currentLanguage);
  localStorage.setItem(LANGUAGE_KEY, currentLanguage);
  document.documentElement.lang = currentLanguage;
  languageSelect.value = currentLanguage;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  if (!operationStartedAt) {
    progressCurrent.textContent = t("progress.idle");
  }
}

function options() {
  return {
    repoRoot: repoRootInput.value.trim(),
    repoUrl: repoUrlInput.value.trim(),
    githubToken: githubTokenInput.value.trim(),
    gitName: gitNameInput.value.trim(),
    gitEmail: gitEmailInput.value.trim(),
    codexHome: codexHomeInput.value.trim(),
    message: messageInput.value.trim() || "sync codex settings",
    dryRun: dryRunInput.checked,
  };
}

function setBusy(isBusy) {
  for (const button of actionButtons) {
    button.disabled = isBusy;
  }
  connectGitHubButton.disabled = isBusy;
  document.body.classList.toggle("is-busy", isBusy);
}

function setStatus(kind, title, copy) {
  statusTitle.textContent = title;
  statusCopy.textContent = copy;
  statusDot.style.background = kind === "error" ? "#bf5b38" : kind === "success" ? "#3d8b5b" : "#d8aa4f";
}

function localizeEventMessage(message) {
  const text = String(message || "");
  let match = text.match(/^Export directory: (.+) -> (.+)$/);
  if (match) return t("log.exportDirectory", { from: match[1], to: match[2] });
  match = text.match(/^Export sanitized config: (.+) -> (.+)$/);
  if (match) return t("log.exportConfig", { from: match[1], to: match[2] });
  match = text.match(/^Skip missing directory: (.+)$/);
  if (match) return t("log.skipMissingDirectory", { path: match[1] });
  match = text.match(/^Skip missing file: (.+)$/);
  if (match) return t("log.skipMissingFile", { path: match[1] });
  match = text.match(/^Uploaded synced settings to (.+) without requiring local Git\.$/);
  if (match) return t("log.uploaded", { target: match[1] });
  match = text.match(/^Downloaded synced settings from (.+) without requiring local Git\.$/);
  if (match) return t("log.downloaded", { target: match[1] });
  match = text.match(/^Install directory: (.+) -> (.+)$/);
  if (match) return t("log.installDirectory", { from: match[1], to: match[2] });
  match = text.match(/^Install file: (.+) -> (.+)$/);
  if (match) return t("log.installFile", { from: match[1], to: match[2] });
  match = text.match(/^Backup: (.+) -> (.+)$/);
  if (match) return t("log.backup", { from: match[1], to: match[2] });
  if (text.startsWith("The GitHub App is installed only on the source repository.")) {
    return t("log.sourceRepoBlocked");
  }
  if (text.startsWith("The repository codex-env-sync is the source code repository.")) {
    return t("log.sourceRepoBlocked");
  }
  if (text.startsWith("Creating private sync repository codex-env-sync-data.")) {
    return t("log.createRepo");
  }
  match = text.match(/^Created private sync repository (.+)\.$/);
  if (match) return t("log.createdRepo", { repo: match[1] });
  if (text.startsWith("GitHub App cannot create the private sync repository yet.")) {
    return t("log.createRepoPermission");
  }
  match = text.match(/^GitHub App installed repositories visible to this account: (.+)\.$/);
  if (match) return t("log.visibleRepos", { repos: match[1] });
  match = text.match(/^The private sync repository (.+) already exists, but this GitHub App authorization cannot see it\./);
  if (match) return t("log.repoExistsButHidden", { repo: match[1] });
  if (text.startsWith("The GitHub App is currently visible only on the source repository.")) {
    return t("log.sourceOnlyInstall");
  }
  match = text.match(/^The GitHub App cannot see a usable codex-env-sync-data repository\. Visible repositories: (.+)\.$/);
  if (match) return t("log.noUsableRepo", { repos: match[1] });
  match = text.match(/^Could not create the private sync repository: (.+)$/);
  if (match) return t("log.createRepoFailed", { reason: match[1] });
  if (text.startsWith("No installed repositories found.")) {
    return t("log.noInstalledRepo");
  }

  const exact = new Map([
    ["Safety check passed: no account files or obvious secrets found.", "log.safetyPassed"],
    ["Export complete.", "log.exportComplete"],
    ["Download complete.", "log.downloadComplete"],
    ["Install complete. Run 'codex login' separately on this machine.", "log.installComplete"],
    [
      "Protected from export: auth.json, history.jsonl, tokens, sessions, credentials, secrets, virtual environments, caches, and reports.",
      "log.protected",
    ],
  ]);
  return exact.has(text) ? t(exact.get(text)) : text;
}

function addEvents(events) {
  for (const event of [...(events || [])].reverse()) {
    const item = document.createElement("li");
    item.className = event.level;
    item.textContent = localizeEventMessage(event.message);
    logList.prepend(item);
  }
}

function formatClock(date) {
  return new Intl.DateTimeFormat(currentLanguage === "zh-CN" ? "zh-CN" : "en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateElapsedTime() {
  if (!operationStartedAt) {
    progressElapsed.textContent = "00:00";
    return;
  }
  progressElapsed.textContent = formatDuration(Date.now() - operationStartedAt);
}

function resetProgress() {
  progressCurrent.textContent = t("progress.idle");
  progressElapsed.textContent = "00:00";
  progressFiles.textContent = t("progress.fileCount", { current: "0", total: "0" });
  progressBarFill.style.width = "0%";
}

function startProgressTimer() {
  operationStartedAt = Date.now();
  updateElapsedTime();
  clearInterval(operationTimer);
  operationTimer = setInterval(updateElapsedTime, 1000);
}

function stopProgressTimer() {
  updateElapsedTime();
  clearInterval(operationTimer);
  operationTimer = null;
}

function progressLabel(progress = {}) {
  const keyByPhase = {
    export: "progress.export",
    upload: "progress.upload",
    commit: "progress.commit",
    download: "progress.download",
    complete: "progress.complete",
  };
  return t(keyByPhase[progress.phase] || "progress.idle");
}

function updateProgress(progress = {}) {
  progressCurrent.textContent = progressLabel(progress);
  const total = Number(progress.total || 0);
  const current = Number(progress.current || 0);
  progressFiles.textContent = t("progress.fileCount", { current: String(current), total: String(total) });
  progressBarFill.style.width = total > 0 ? `${Math.min(100, Math.round((current / total) * 100))}%` : "0%";
}

function logOperationPlan(kind) {
  const steps =
    kind === "upload"
      ? ["steps.upload.safety", "steps.upload.export", "steps.upload.push"]
      : ["steps.download.fetch", "steps.download.safety", "steps.download.install"];
  addEvents(steps.map((step) => ({ level: "info", message: t("log.step", { step: t(step) }) })));
}

function openAuthDialog(code) {
  authFinished = false;
  authDialogCode.textContent = code;
  authDialogCopy.textContent = t("auth.dialog.copy");
  if (typeof authDialog.showModal === "function" && !authDialog.open) {
    authDialog.showModal();
  } else {
    authDialog.setAttribute("open", "");
  }
}

function closeAuthDialog() {
  if (typeof authDialog.close === "function" && authDialog.open) {
    authDialog.close();
  } else {
    authDialog.removeAttribute("open");
  }
}

async function copyAuthCode() {
  const code = authDialogCode.textContent.trim();
  if (!code || code === "----") {
    return;
  }
  try {
    await navigator.clipboard.writeText(code);
    authDialogCopy.textContent = t("auth.dialog.copyDone");
  } catch {
    authDialogCopy.textContent = code;
  }
}

function openCompleteDialog(kind) {
  completeDialogEyebrow.textContent = t("complete.eyebrow");
  completeDialogTitle.textContent = t(kind === "upload" ? "complete.upload.title" : "complete.download.title");
  completeDialogCopy.textContent = t(kind === "upload" ? "complete.upload.copy" : "complete.download.copy");
  if (typeof completeDialog.showModal === "function" && !completeDialog.open) {
    completeDialog.showModal();
  } else {
    completeDialog.setAttribute("open", "");
  }
}

function closeCompleteDialog() {
  if (typeof completeDialog.close === "function" && completeDialog.open) {
    completeDialog.close();
  } else {
    completeDialog.removeAttribute("open");
  }
}

function openGitHubRepo() {
  window.codexSync.openExternal(GITHUB_REPO_URL);
}

async function cancelAuthFlow() {
  if (!currentAuthSessionId || authFinished) {
    closeAuthDialog();
    return;
  }
  await window.codexSync.cancelGitHubAuth({ sessionId: currentAuthSessionId });
  currentAuthSessionId = "";
  githubAuthCopy.textContent = t("auth.code.cancelled");
  authDialogCopy.textContent = t("auth.dialog.cancelled");
  addEvents([{ level: "info", message: t("log.authCancelled") }]);
  setStatus("info", t("status.ready.title"), t("status.ready.copy"));
  setBusy(false);
  setTimeout(closeAuthDialog, 800);
}

async function runAction(action, label, kind) {
  if (document.body.classList.contains("is-busy")) {
    return;
  }
  saveSettings();
  setBusy(true);
  resetProgress();
  startProgressTimer();
  setStatus("info", t("state.running", { label }), t("status.running.copy"));
  addEvents([{ level: "info", message: t("log.started", { label }) }]);
  if (kind) {
    logOperationPlan(kind);
  }

  let elapsedLogged = false;
  try {
    const result = await action(options());
    addEvents(result.events);
    stopProgressTimer();
    addEvents([{ level: "info", message: t("log.elapsed", { time: progressElapsed.textContent }) }]);
    elapsedLogged = true;
    setStatus(result.ok ? "success" : "error", result.ok ? t("state.complete", { label }) : t("state.blocked", { label }), result.ok ? t("status.complete.copy") : t("status.blocked.copy"));
    if (result.ok && (kind === "upload" || kind === "download")) {
      openCompleteDialog(kind);
    }
  } catch (error) {
    addEvents([{ level: "error", message: error.stack || error.message }]);
    setStatus("error", t("state.failed", { label }), t("status.failed.copy"));
  } finally {
    stopProgressTimer();
    if (!elapsedLogged) {
      addEvents([{ level: "info", message: t("log.elapsed", { time: progressElapsed.textContent }) }]);
    }
    setBusy(false);
  }
}

async function connectGitHub() {
  if (document.body.classList.contains("is-busy")) {
    return;
  }
  saveSettings();
  const label = t("action.connect");
  setBusy(true);
  setStatus("info", t("state.running", { label }), t("status.running.copy"));
  addEvents([{ level: "info", message: t("log.started", { label }) }]);

  try {
    const started = await window.codexSync.startGitHubAuth();
    clearGitHubIdentityFields("pending");
    saveSettings();
    currentAuthSessionId = started.sessionId || "";
    githubUserCode.textContent = started.userCode;
    githubAuthCopy.textContent = t("auth.code.waiting");
    openAuthDialog(started.userCode);
    addEvents([{ level: "info", message: t("log.authCode", { code: started.userCode }) }]);
    const waitingHintTimer = setTimeout(() => {
      githubAuthCopy.textContent = t("auth.waitingHint");
      authDialogCopy.textContent = t("auth.waitingHint");
      addEvents([{ level: "info", message: t("auth.waitingHint") }]);
    }, 15000);
    const longWaitHintTimer = setTimeout(() => {
      githubAuthCopy.textContent = t("auth.longWaitHint");
      authDialogCopy.textContent = t("auth.longWaitHint");
      addEvents([{ level: "info", message: t("auth.longWaitHint") }]);
    }, 45000);

    let completed;
    try {
      completed = await window.codexSync.completeGitHubAuth({
        sessionId: currentAuthSessionId,
        deviceCode: started.deviceCode,
        interval: started.interval,
        expiresIn: started.expiresIn,
      });
    } finally {
      clearTimeout(waitingHintTimer);
      clearTimeout(longWaitHintTimer);
    }

    authFinished = true;
    currentAuthSessionId = "";
    if (completed.ok && completed.user) {
      applyConnectedGitHubSettings(completed);
    } else {
      clearGitHubIdentityFields("blocked");
    }
    addEvents(completed.events);
    saveSettings();
    githubAuthCopy.textContent = completed.ok ? t("auth.code.complete") : t("auth.code.installMissing");
    authDialogCopy.textContent = completed.ok ? t("auth.dialog.complete") : t("auth.dialog.installMissing");
    if (completed.ok) {
      setTimeout(closeAuthDialog, 1200);
    }
    setStatus(completed.ok ? "success" : "error", completed.ok ? t("state.complete", { label }) : t("state.blocked", { label }), completed.ok ? t("status.complete.copy") : t("status.blocked.copy"));
  } catch (error) {
    const isCancelled = String(error.message || error).includes("cancelled");
    addEvents([{ level: isCancelled ? "info" : "error", message: isCancelled ? t("log.authCancelled") : error.stack || error.message }]);
    githubAuthCopy.textContent = isCancelled ? t("auth.code.cancelled") : t("auth.code.failed");
    authDialogCopy.textContent = isCancelled ? t("auth.dialog.cancelled") : t("auth.dialog.failed");
    setStatus(isCancelled ? "info" : "error", isCancelled ? t("status.ready.title") : t("state.failed", { label }), isCancelled ? t("status.ready.copy") : t("status.failed.copy"));
  } finally {
    setBusy(false);
  }
}

async function init() {
  const state = await window.codexSync.getDefaultState();
  const saved = loadSavedSettings();
  const trustedSavedIdentity = hasTrustedSavedGitHubIdentity(saved);
  currentGitHubLogin = trustedSavedIdentity ? saved.githubLogin : "";
  currentGitHubAuthStatus = trustedSavedIdentity ? saved.githubAuthStatus : "";
  applyLanguage(currentLanguage);
  repoRootInput.value = saved.repoRoot || state.repoRoot;
  repoUrlInput.value = saved.repoUrl || "";
  githubTokenInput.value = "";
  gitNameInput.value = trustedSavedIdentity ? saved.gitName || "" : "";
  gitEmailInput.value = trustedSavedIdentity ? saved.gitEmail || "" : "";
  codexHomeInput.value = saved.codexHome || state.codexHome;
  messageInput.value = saved.message || messageInput.value;

  languageSelect.addEventListener("change", () => {
    applyLanguage(languageSelect.value);
    setStatus("info", t("status.ready.title"), t("status.ready.copy"));
  });

  connectGitHubButton.addEventListener("click", connectGitHub);
  copyAuthCodeButton.addEventListener("click", copyAuthCode);
  closeAuthDialogButton.addEventListener("click", cancelAuthFlow);
  starGitHubButton.addEventListener("click", openGitHubRepo);
  closeCompleteDialogButton.addEventListener("click", closeCompleteDialog);
  window.codexSync.onProgress(updateProgress);
  resetProgress();
  document.querySelector("#upload-button").addEventListener("click", () => runAction(window.codexSync.upload, t("action.upload"), "upload"));
  document.querySelector("#download-button").addEventListener("click", () => runAction(window.codexSync.download, t("action.download"), "download"));
}

init();
