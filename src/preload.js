const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("codexSync", {
  getDefaultState: () => ipcRenderer.invoke("state:get-default"),
  check: (options) => ipcRenderer.invoke("sync:check", options),
  setup: (options) => ipcRenderer.invoke("sync:setup", options),
  upload: (options) => ipcRenderer.invoke("sync:upload", options),
  download: (options) => ipcRenderer.invoke("sync:download", options),
});
