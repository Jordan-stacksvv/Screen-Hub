// ScreenHub Control Center — Electron main process
// Loads either the local `dist-desktop/` bundle (packaged builds) or the live
// Lovable Cloud URL passed as SCREENHUB_URL (dev). All backend calls go through
// the existing web app; this process only provides native workflows.
const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, dialog, shell, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");

const isDev = !app.isPackaged;
const DEFAULT_REMOTE_URL = "https://screen-hub-eta.vercel.app";
const REMOTE_URL = process.env.SCREENHUB_URL || DEFAULT_REMOTE_URL;
const STATE_FILE = path.join(app.getPath("userData"), "window.json");

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch { return null; }
}
function writeState(win) {
  try {
    const [w, h] = win.getSize();
    const [x, y] = win.getPosition();
    fs.writeFileSync(STATE_FILE, JSON.stringify({ w, h, x, y, maximized: win.isMaximized() }));
  } catch { /* noop */ }
}

let mainWindow = null;
let tray = null;

function createWindow() {
  const s = readState() || { w: 1400, h: 900 };
  mainWindow = new BrowserWindow({
    width: s.w, height: s.h, x: s.x, y: s.y,
    minWidth: 1024, minHeight: 640,
    backgroundColor: "#0a0a0f",
    title: "ScreenHub Control Center",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  if (s.maximized) mainWindow.maximize();

  const target = REMOTE_URL
    ? `${REMOTE_URL.replace(/\/$/, "")}/desktop`
    : `file://${path.join(__dirname, "..", "dist-desktop", "index.html")}`;
  let retryTimer = null;
  const offlineHtmlContent = "<html><body style=\"background:#0a0a0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px;\"><h2>You are offline</h2><p style=\"color:#888\">Waiting for connection to ScreenHub...</p></body></html>";
  function loadWithFallback(win, url) {
    win.loadURL(url).catch(() => {
      win.loadURL("data:text/html," + encodeURIComponent(offlineHtmlContent));
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => loadWithFallback(win, url), 5000);
    });
  }
  
  loadWithFallback(mainWindow, target);
  
  mainWindow.webContents.on("did-fail-load", (e, code) => {
    if (code === -3) return;
    mainWindow.loadURL("data:text/html," + encodeURIComponent(offlineHtmlContent));
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => loadWithFallback(mainWindow, target), 5000);
  });

  mainWindow.on("close", () => writeState(mainWindow));
  mainWindow.on("closed", () => { mainWindow = null; });

  // Forward native file drops to the renderer with real paths.
  mainWindow.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("file://") && !url.startsWith(REMOTE_URL)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
}

function openChildWindow(routePath, opts = {}) {
  const child = new BrowserWindow({
    width: opts.width || 1000,
    height: opts.height || 700,
    title: opts.title || "ScreenHub",
    backgroundColor: "#0a0a0f",
    autoHideMenuBar: true,
    parent: opts.modal ? mainWindow : undefined,
    modal: !!opts.modal,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  const base = REMOTE_URL.replace(/\/$/, "");
  child.loadURL("${base}${routePath}");
  return child;
}

function createTray() {
  const iconPath = path.join(__dirname, "assets", "tray.png");
  const image = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  tray = new Tray(image);
  tray.setToolTip("ScreenHub Control Center");
  const menu = Menu.buildFromTemplate([
    { label: "Show window", click: () => mainWindow?.show() },
    { label: "Live Control", click: () => mainWindow?.webContents.send("screenhub:navigate", "/desktop/live-control") },
    { label: "New broadcast", click: () => mainWindow?.webContents.send("screenhub:navigate", "/desktop/broadcasts") },
    { type: "separator" },
    { role: "quit" },
  ]);
  tray.setContextMenu(menu);
  tray.on("click", () => mainWindow?.show());
}

// ─── IPC bridge ─────────────────────────────────────────
function setAutoLaunch(enabled) {
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: true,
    });
  } catch { /* noop */ }
}

ipcMain.on("screenhub:open-window", (_e, { path: routePath, title, width, height, modal }) => {
  openChildWindow(routePath, { title, width, height, modal });
});

ipcMain.handle("screenhub:pick-files", async (_e, opts = {}) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: opts.title || "Select files",
    properties: ["openFile", "multiSelections"],
    filters: opts.filters || [
      { name: "Media", extensions: ["png", "jpg", "jpeg", "webp", "mp4", "webm", "pdf"] },
    ],
  });
  if (canceled) return [];
  return filePaths.map((p) => {
    const stat = fs.statSync(p);
    return { path: p, name: path.basename(p), size: stat.size };
  });
});

ipcMain.on("screenhub:notify", (_e, { title, body }) => {
  if (Notification.isSupported()) new Notification({ title, body }).show();
});

ipcMain.on("screenhub:open-external", (_e, url) => { if (typeof url === "string") shell.openExternal(url); });

ipcMain.handle("screenhub:context-menu", async (_e, items) => {
  return new Promise((resolve) => {
    const template = (items || []).map((it) =>
      it.type === "separator"
        ? { type: "separator" }
        : { label: it.label, enabled: it.enabled !== false, click: () => resolve(it.id) }
    );
    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: mainWindow, callback: () => resolve(null) });
  });
});

ipcMain.handle("screenhub:get-auto-launch", () => app.getLoginItemSettings().openAtLogin);
ipcMain.on("screenhub:set-auto-launch", (_e, enabled) => setAutoLaunch(!!enabled));

ipcMain.on("screenhub:tray-status", (_e, { status, count }) => {
  if (!tray) return;
  tray.setToolTip(`ScreenHub · ${status} · ${count ?? 0} devices`);
});

// ─── App lifecycle ──────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();

  autoUpdater.checkForUpdatesAndNotify();
  setAutoLaunch(true);
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

