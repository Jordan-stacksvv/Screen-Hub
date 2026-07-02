// Exposes a minimal, typed bridge on `window.screenhub`. No Node APIs leak.
const { contextBridge, ipcRenderer } = require("electron");

const listeners = new Map();
function on(channel, cb) {
  const wrapped = (_e, payload) => cb(payload);
  ipcRenderer.on(channel, wrapped);
  listeners.set(cb, [channel, wrapped]);
  return () => {
    const entry = listeners.get(cb);
    if (entry) { ipcRenderer.removeListener(entry[0], entry[1]); listeners.delete(cb); }
  };
}

contextBridge.exposeInMainWorld("screenhub", {
  platform: process.platform,
  pickFiles: (opts) => ipcRenderer.invoke("screenhub:pick-files", opts),
  notify: (payload) => ipcRenderer.send("screenhub:notify", payload),
  openExternal: (url) => ipcRenderer.send("screenhub:open-external", url),
  contextMenu: (items) => ipcRenderer.invoke("screenhub:context-menu", items),
  tray: {
    setStatus: (status, count) => ipcRenderer.send("screenhub:tray-status", { status, count }),
  },
  onNavigate: (cb) => on("screenhub:navigate", cb),
});
