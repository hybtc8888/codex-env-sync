const { app, BrowserWindow, ipcMain, powerSaveBlocker, shell } = require("electron");
const path = require("node:path");
const os = require("node:os");
const {
  DEFAULT_SYNC_REPOSITORY_NAME,
  GITHUB_APP_PUBLIC_URL,
  createPrivateSyncRepository,
  fetchGitHubAppRepositories,
  fetchGitHubViewer,
  isSourceRepository,
  requestDeviceCode,
  selectPreferredRepository,
  waitForDeviceAuthorization,
} = require("./core/github-auth");
const {
  checkSyncSafety,
  configureRepository,
  downloadSettings,
  getDefaultState,
  uploadSettings,
} = require("./core/sync");
const { runWithPowerSaveBlocker } = require("./core/power-save");

const authSessions = new Map();

function formatRepositoryList(repositories) {
  if (!repositories || repositories.length === 0) {
    return "none";
  }
  return repositories.map((repo) => repo.fullName).filter(Boolean).join(", ");
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 920,
    minHeight: 640,
    title: "Codex Env Sync",
    backgroundColor: "#f8f3e8",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, "ui", "index.html"));
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle("state:get-default", () => getDefaultState({ repoRoot: path.join(os.homedir(), DEFAULT_SYNC_REPOSITORY_NAME) }));
ipcMain.handle("sync:check", (_event, options) => checkSyncSafety(options));
ipcMain.handle("sync:setup", (_event, options) => configureRepository(options));
ipcMain.handle("sync:upload", (event, options) =>
  runWithPowerSaveBlocker(powerSaveBlocker, () =>
    uploadSettings({
      ...options,
      onProgress: (progress) => event.sender.send("sync:progress", progress),
    })
  )
);
ipcMain.handle("sync:download", (event, options) =>
  runWithPowerSaveBlocker(powerSaveBlocker, () =>
    downloadSettings({
      ...options,
      onProgress: (progress) => event.sender.send("sync:progress", progress),
    })
  )
);
ipcMain.handle("shell:open-external", (_event, url) => shell.openExternal(url));

ipcMain.handle("github-auth:start", async (_event, options = {}) => {
  const device = await requestDeviceCode({ clientId: options.clientId });
  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  authSessions.set(sessionId, { cancelled: false });
  await shell.openExternal(device.verificationUriComplete || device.verificationUri);
  return {
    ok: true,
    sessionId,
    ...device,
    events: [
      {
        level: "info",
        message: `GitHub opened in your browser. Enter code ${device.userCode} if GitHub asks for it.`,
      },
    ],
  };
});

ipcMain.handle("github-auth:complete", async (_event, options = {}) => {
  const session = authSessions.get(options.sessionId) || { cancelled: false };
  const token = await waitForDeviceAuthorization({
    clientId: options.clientId,
    deviceCode: options.deviceCode,
    interval: options.interval,
    expiresIn: options.expiresIn,
    shouldCancel: () => session.cancelled,
  });
  authSessions.delete(options.sessionId);
  const authOptions = { githubToken: token.accessToken };
  const user = await fetchGitHubViewer(authOptions);
  const repositories = await fetchGitHubAppRepositories(authOptions);
  const events = [{ level: "success", message: `Connected GitHub as ${user.login}.` }];
  events.push({ level: "info", message: `GitHub App installed repositories visible to this account: ${formatRepositoryList(repositories)}.` });
  let repository = selectPreferredRepository(repositories);
  const hasInstalledRepositories = repositories.length > 0;
  const installedOnlySourceRepository = hasInstalledRepositories && repositories.every(isSourceRepository);
  let createAttempted = false;

  if (!repository) {
    createAttempted = true;
    events.push({ level: "info", message: `Creating private sync repository ${DEFAULT_SYNC_REPOSITORY_NAME}.` });
    try {
      repository = await createPrivateSyncRepository(authOptions);
      events.push({ level: "success", message: `Created private sync repository ${repository.fullName}.` });
    } catch (error) {
      const message = String(error.message || error);
      const alreadyExists = error.status === 422 && /already exists|name already exists|Repository creation failed/i.test(message);
      events.push({
        level: "error",
        message:
          alreadyExists
            ? `The private sync repository ${user.login}/${DEFAULT_SYNC_REPOSITORY_NAME} already exists, but this GitHub App authorization cannot see it. Install or update the app so it includes that repository, then connect again.`
            : installedOnlySourceRepository
              ? `The GitHub App is currently visible only on the source repository. Add ${DEFAULT_SYNC_REPOSITORY_NAME} to the app installation, then connect again.`
              : message.includes("Resource not accessible") || message.includes("403")
                ? "GitHub App cannot create the private sync repository yet. Add Repository permissions: Administration Read and write, then approve the permission update on the app installation page."
                : `Could not create the private sync repository: ${message}`,
      });
    }
  }

  return {
    ok: Boolean(repository),
    githubToken: token.accessToken,
    user,
    repository,
    repositories,
    installUrl: GITHUB_APP_PUBLIC_URL,
    events: repository
      ? [...events, { level: "success", message: `Selected repository ${repository.fullName}.` }]
      : [
          ...events,
          ...(createAttempted
            ? []
            : [
                {
                  level: "error",
                  message: hasInstalledRepositories
                    ? `The GitHub App cannot see a usable ${DEFAULT_SYNC_REPOSITORY_NAME} repository. Visible repositories: ${formatRepositoryList(repositories)}.`
                    : `No installed repositories found. Install the GitHub App at ${GITHUB_APP_PUBLIC_URL}.`,
                },
              ]),
        ],
  };
});

ipcMain.handle("github-auth:cancel", (_event, options = {}) => {
  const session = authSessions.get(options.sessionId);
  if (session) {
    session.cancelled = true;
  }
  return { ok: true };
});
