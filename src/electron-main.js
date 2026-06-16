const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const os = require("node:os");
const {
  checkSyncSafety,
  configureRepository,
  downloadSettings,
  getDefaultState,
  uploadSettings,
} = require("./core/sync");

function createWindow() {
  const win = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 920,
    minHeight: 640,
    title: "Codex Env Sync",
    backgroundColor: "#11120f",
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

ipcMain.handle("state:get-default", () => getDefaultState({ repoRoot: path.join(os.homedir(), "codex-env-sync") }));
ipcMain.handle("sync:check", (_event, options) => checkSyncSafety(options));
ipcMain.handle("sync:setup", (_event, options) => configureRepository(options));
ipcMain.handle("sync:upload", (_event, options) => uploadSettings(options));
ipcMain.handle("sync:download", (_event, options) => downloadSettings(options));
