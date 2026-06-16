const repoRootInput = document.querySelector("#repo-root");
const languageSelect = document.querySelector("#language-select");
const repoUrlInput = document.querySelector("#repo-url");
const githubTokenInput = document.querySelector("#github-token");
const gitNameInput = document.querySelector("#git-name");
const gitEmailInput = document.querySelector("#git-email");
const codexHomeInput = document.querySelector("#codex-home");
const messageInput = document.querySelector("#commit-message");
const dryRunInput = document.querySelector("#dry-run");
const statusDot = document.querySelector("#status-dot");
const statusTitle = document.querySelector("#status-title");
const statusCopy = document.querySelector("#status-copy");
const logList = document.querySelector("#log-list");
const actionButtons = Array.from(document.querySelectorAll(".action"));

const STORAGE_KEY = "codex-env-sync-settings";
const LANGUAGE_KEY = "codex-env-sync-language";
let currentLanguage = window.CodexEnvSyncI18n.normalizeLanguage(localStorage.getItem(LANGUAGE_KEY) || navigator.language);
let t = window.CodexEnvSyncI18n.createTranslator(currentLanguage);

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
    codexHome: codexHomeInput.value.trim(),
    message: messageInput.value.trim(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
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
  document.body.classList.toggle("is-busy", isBusy);
}

function setStatus(kind, title, copy) {
  statusTitle.textContent = title;
  statusCopy.textContent = copy;
  statusDot.style.background = kind === "error" ? "#bf5b38" : kind === "success" ? "#3d8b5b" : "#d8aa4f";
}

function addEvents(events) {
  for (const event of events || []) {
    const item = document.createElement("li");
    item.className = event.level;
    item.textContent = event.message;
    logList.prepend(item);
  }
}

async function runAction(action, label) {
  if (document.body.classList.contains("is-busy")) {
    return;
  }
  saveSettings();
  setBusy(true);
  setStatus("info", t("state.running", { label }), t("status.running.copy"));
  addEvents([{ level: "info", message: t("log.started", { label }) }]);

  try {
    const result = await action(options());
    addEvents(result.events);
    setStatus(result.ok ? "success" : "error", result.ok ? t("state.complete", { label }) : t("state.blocked", { label }), result.ok ? t("status.complete.copy") : t("status.blocked.copy"));
  } catch (error) {
    addEvents([{ level: "error", message: error.stack || error.message }]);
    setStatus("error", t("state.failed", { label }), t("status.failed.copy"));
  } finally {
    setBusy(false);
  }
}

async function init() {
  const state = await window.codexSync.getDefaultState();
  const saved = loadSavedSettings();
  applyLanguage(currentLanguage);
  repoRootInput.value = saved.repoRoot || state.repoRoot;
  repoUrlInput.value = saved.repoUrl || "";
  githubTokenInput.value = "";
  gitNameInput.value = saved.gitName || "";
  gitEmailInput.value = saved.gitEmail || "";
  codexHomeInput.value = saved.codexHome || state.codexHome;
  messageInput.value = saved.message || messageInput.value;

  languageSelect.addEventListener("change", () => {
    applyLanguage(languageSelect.value);
    setStatus("info", t("status.ready.title"), t("status.ready.copy"));
  });

  document.querySelector("#setup-button").addEventListener("click", () => runAction(window.codexSync.setup, t("action.setup")));
  document.querySelector("#upload-button").addEventListener("click", () => runAction(window.codexSync.upload, t("action.upload")));
  document.querySelector("#download-button").addEventListener("click", () => runAction(window.codexSync.download, t("action.download")));
  document.querySelector("#check-button").addEventListener("click", () => runAction(window.codexSync.check, t("action.check")));
}

init();
