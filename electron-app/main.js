const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

let mainWindow;
let pythonProcess;

const BACKEND_PORT = 8000;
const FRONTEND_URL = "http://localhost:3000";

// Wait until backend is ready
function waitForBackend(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    function check() {
      http
        .get(url, () => resolve())
        .on("error", () => {
          if (Date.now() - start > timeout) {
            reject(new Error("Backend did not start in time"));
          } else {
            setTimeout(check, 1000);
          }
        });
    }

    check();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(FRONTEND_URL);
}

app.whenReady().then(async () => {
  // 🔥 Start Python backend
  const backendPath = path.join(__dirname, "../backend/main.py");

  pythonProcess = spawn("python", [backendPath], {
    stdio: "inherit",
  });

  try {
    await waitForBackend(`http://localhost:${BACKEND_PORT}/health`);
    createWindow();
  } catch (err) {
    console.error("Backend failed to start:", err);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});