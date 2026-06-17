const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("codexSync", {
  getDefaultState: () => ipcRenderer.invoke("state:get-default"),
  check: (options) => ipcRenderer.invoke("sync:check", options),
  setup: (options) => ipcRenderer.invoke("sync:setup", options),
  upload: (options) => ipcRenderer.invoke("sync:upload", options),
  download: (options) => ipcRenderer.invoke("sync:download", options),
  startGitHubAuth: (options) => ipcRenderer.invoke("github-auth:start", options),
  completeGitHubAuth: (options) => ipcRenderer.invoke("github-auth:complete", options),
  cancelGitHubAuth: (options) => ipcRenderer.invoke("github-auth:cancel", options),
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),
  onProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("sync:progress", listener);
    return () => ipcRenderer.removeListener("sync:progress", listener);
  },
});
