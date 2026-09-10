const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  session,
  shell,
  utilityProcess,
} = require("electron");
const { createServer } = require("node:net");
const { randomBytes } = require("node:crypto");
const path = require("node:path");
const fs = require("node:fs");
let serverProcess,
  window,
  baseUrl,
  quitting = false;
let preferenceQueue = Promise.resolve();
const dataDirectory = () =>
  process.env.GITGROVE_TEST_DATA_DIR || app.getPath("userData");
const devUrl = !app.isPackaged ? process.env.ELECTRON_DEV_URL : null;
app.setName("Gitgrove");
// Give desktop tests their own Electron session and single-instance lock.
if (process.env.GITGROVE_TEST_DATA_DIR) {
  fs.mkdirSync(process.env.GITGROVE_TEST_DATA_DIR, { recursive: true });
  app.setPath("userData", process.env.GITGROVE_TEST_DATA_DIR);
}
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.on("second-instance", () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    }
  });
  app
    .whenReady()
    .then(start)
    .catch((error) => {
      dialog.showErrorBox("Gitgrove no pudo abrirse", error.message);
      app.quit();
    });
}
async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
async function start() {
  nativeTheme.themeSource = "dark";
  const token = randomBytes(32).toString("hex");
  if (devUrl) baseUrl = devUrl;
  else {
    const port = await freePort();
    baseUrl = `http://127.0.0.1:${port}`;
    const serverRoot = app.isPackaged
      ? path.join(process.resourcesPath, "server")
      : path.join(__dirname, "..", ".next", "standalone");
    const dataDir = dataDirectory();
    fs.mkdirSync(dataDir, { recursive: true });
    const log = fs.createWriteStream(path.join(dataDir, "server.log"), {
      flags: "w",
    });
    serverProcess = utilityProcess.fork(
      path.join(serverRoot, "server.js"),
      [],
      {
        cwd: serverRoot,
        env: {
          ...process.env,
          NODE_ENV: "production",
          HOSTNAME: "127.0.0.1",
          PORT: String(port),
          GITGROVE_TOKEN: token,
          GITGROVE_DATA_DIR: dataDir,
          PATH: `${process.env.PATH || ""}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`,
        },
        stdio: "pipe",
        serviceName: "Gitgrove Local Server",
      },
    );
    serverProcess.stdout?.pipe(log);
    serverProcess.stderr?.pipe(log, { end: false });
    serverProcess.on("exit", (code) => {
      if (!quitting) {
        dialog.showErrorBox(
          "El servidor local se detuvo",
          `Cerrá y volvé a abrir Gitgrove. Código: ${code}. Registro: ${path.join(dataDir, "server.log")}`,
        );
        app.quit();
      }
    });
    await session.defaultSession.cookies.set({
      url: baseUrl,
      name: "gitgrove-session",
      value: token,
      httpOnly: true,
      sameSite: "strict",
    });
    let connected = false;
    for (let attempt = 0; attempt < 150; attempt++) {
      try {
        const response = await fetch(baseUrl);
        if (response.ok) {
          connected = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (!connected)
      throw new Error(
        "El servidor local no respondió. Revisá server.log en los datos de la app.",
      );
  }
  const validSender = (event) => {
    if (
      !event.senderFrame ||
      new URL(event.senderFrame.url).origin !== new URL(baseUrl).origin
    )
      throw new Error("Origen no permitido.");
  };
  ipcMain.handle("get-preferences", async (event) => {
    validSender(event);
    try {
      return JSON.parse(
        await fs.promises.readFile(
          path.join(dataDirectory(), "preferences.json"),
          "utf8",
        ),
      );
    } catch {
      return null;
    }
  });
  ipcMain.handle("set-preferences", async (event, preferences) => {
    validSender(event);
    if (
      !preferences ||
      !Array.isArray(preferences.tabs) ||
      typeof preferences.active !== "string" ||
      typeof preferences.dense !== "boolean" ||
      typeof preferences.autoRefresh !== "boolean"
    )
      throw new Error("Preferencias inválidas.");
    const safe = {
      tabs: preferences.tabs
        .filter(
          (tab) =>
            tab &&
            typeof tab.path === "string" &&
            path.isAbsolute(tab.path) &&
            typeof tab.name === "string",
        )
        .slice(0, 30)
        .map((tab) => ({ path: tab.path, name: tab.name })),
      active: preferences.active,
      dense: preferences.dense,
      autoRefresh: preferences.autoRefresh,
    };
    preferenceQueue = preferenceQueue
      .catch(() => {})
      .then(async () => {
        await fs.promises.mkdir(dataDirectory(), { recursive: true });
        const file = path.join(dataDirectory(), "preferences.json");
        await fs.promises.writeFile(`${file}.tmp`, JSON.stringify(safe), {
          mode: 0o600,
        });
        await fs.promises.rename(`${file}.tmp`, file);
      });
    await preferenceQueue;
  });
  ipcMain.handle("choose-directory", async (event) => {
    validSender(event);
    const result = await dialog.showOpenDialog(window, {
      title: "Elegí una carpeta",
      properties: ["openDirectory", "createDirectory"],
    });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle("reveal", async (event, target) => {
    validSender(event);
    if (typeof target !== "string" || !path.isAbsolute(target))
      throw new Error("Ruta inválida.");
    shell.showItemInFolder(target);
  });
  ipcMain.handle("open-external", async (event, url) => {
    validSender(event);
    if (
      typeof url !== "string" ||
      !/^https:\/\/(github\.com|docs\.github\.com|cli\.github\.com)(\/|$)/.test(
        url,
      )
    )
      throw new Error("URL no permitida.");
    await shell.openExternal(url);
  });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Gitgrove",
        submenu: [
          { role: "about" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      {
        label: "Edición",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
        ],
      },
      {
        label: "Visualización",
        submenu: [
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
      {
        label: "Ventana",
        submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "front" }],
      },
    ]),
  );
  createWindow();
}
function createWindow() {
  window = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 960,
    minHeight: 600,
    title: "Gitgrove",
    backgroundColor: "#1c1f21",
    show: false,
    titleBarStyle: "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\/github\.com\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== new URL(baseUrl).origin) event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  window.once("ready-to-show", () => window.show());
  window.on("closed", () => {
    window = null;
  });
  void window.loadURL(baseUrl);
}
app.on("activate", () => {
  if (!window && baseUrl) createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  quitting = true;
  serverProcess?.kill();
});
