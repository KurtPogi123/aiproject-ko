const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");

let mainWindow;
let pythonProcess;

const BACKEND_PORT = 8000;

function getResourcePath(relativePath) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, relativePath);
  }
  return path.join(__dirname, relativePath);
}

function getBackendPath() {
  return getResourcePath(path.join("backend", "backend.exe"));
}

function getFrontendPath() {
  return getResourcePath("frontend");
}

function waitForBackend(timeout = 60000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    function check() {
      const req = http.get(`http://localhost:${BACKEND_PORT}/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      });
      req.on("error", retry);
      req.setTimeout(1000, () => { req.destroy(); retry(); });
    }

    function retry() {
      if (Date.now() - start > timeout) {
        reject(new Error("Backend did not start within 60 seconds"));
      } else {
        setTimeout(check, 1500);
      }
    }

    check();
  });
}

function startBackend() {
  return new Promise((resolve, reject) => {
    const backendPath = getBackendPath();

    if (!fs.existsSync(backendPath)) {
      reject(new Error(`Backend not found at:\n${backendPath}`));
      return;
    }

    console.log("Starting backend:", backendPath);

    // Use shell:true to handle paths with spaces
    pythonProcess = spawn(`"${backendPath}"`, [], {
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    pythonProcess.stdout.on("data", (d) => console.log("Backend:", d.toString()));
    pythonProcess.stderr.on("data", (d) => console.error("Backend err:", d.toString()));

    pythonProcess.on("error", (err) => {
      reject(new Error(`Failed to start backend: ${err.message}`));
    });

    pythonProcess.on("exit", (code) => {
      console.log(`Backend exited with code: ${code}`);
    });

    resolve();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  const indexPath = path.join(getFrontendPath(), "index.html");

  if (!fs.existsSync(indexPath)) {
    dialog.showErrorBox("Missing Frontend", `Frontend not found at:\n${indexPath}`);
    app.quit();
    return;
  }

  mainWindow.loadFile(indexPath);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    await startBackend();
    console.log("Backend spawned, waiting for it to be ready...");
    await waitForBackend(60000);
    console.log("Backend ready!");
    createWindow();
  } catch (err) {
    console.error("Startup error:", err);
    dialog.showErrorBox("Startup Failed", err.message);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});