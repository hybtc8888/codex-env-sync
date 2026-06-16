const repoRootInput = document.querySelector("#repo-root");
const codexHomeInput = document.querySelector("#codex-home");
const messageInput = document.querySelector("#commit-message");
const dryRunInput = document.querySelector("#dry-run");
const statusDot = document.querySelector("#status-dot");
const statusTitle = document.querySelector("#status-title");
const statusCopy = document.querySelector("#status-copy");
const logList = document.querySelector("#log-list");

function options() {
  return {
    repoRoot: repoRootInput.value.trim(),
    codexHome: codexHomeInput.value.trim(),
    message: messageInput.value.trim() || "sync codex settings",
    dryRun: dryRunInput.checked,
  };
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
  setStatus("info", `${label} running`, "Keep this window open while the operation finishes.");
  addEvents([{ level: "info", message: `${label} started.` }]);

  try {
    const result = await action(options());
    addEvents(result.events);
    setStatus(result.ok ? "success" : "error", result.ok ? `${label} complete` : `${label} blocked`, result.ok ? "Review the activity log for details." : "Fix the reported issue and try again.");
  } catch (error) {
    addEvents([{ level: "error", message: error.stack || error.message }]);
    setStatus("error", `${label} failed`, "Unexpected error. Review the activity log.");
  }
}

async function init() {
  const state = await window.codexSync.getDefaultState();
  repoRootInput.value = state.repoRoot;
  codexHomeInput.value = state.codexHome;

  document.querySelector("#upload-button").addEventListener("click", () => runAction(window.codexSync.upload, "Upload"));
  document.querySelector("#download-button").addEventListener("click", () => runAction(window.codexSync.download, "Download"));
  document.querySelector("#check-button").addEventListener("click", () => runAction(window.codexSync.check, "Safety check"));
}

init();

