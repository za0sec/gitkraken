const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  getPreferences: () => ipcRenderer.invoke("get-preferences"),
  setPreferences: (preferences) =>
    ipcRenderer.invoke("set-preferences", preferences),
  chooseDirectory: () => ipcRenderer.invoke("choose-directory"),
  reveal: (path) => ipcRenderer.invoke("reveal", path),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
});
