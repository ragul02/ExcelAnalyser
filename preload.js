const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopStudio', {
  chooseProjectFile: () => ipcRenderer.invoke('project:choose-open'),
});
