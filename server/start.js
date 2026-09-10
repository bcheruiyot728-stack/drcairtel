const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'index.js');
const envFile = path.join(__dirname, '.env');
let serverProcess = null;
let restartTimer = null;

const startServer = () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }

  serverProcess = spawn(process.execPath, [serverFile], {
    cwd: __dirname,
    stdio: 'inherit'
  });

  serverProcess.on('exit', (code, signal) => {
    if (signal === 'SIGTERM' || signal === 'SIGINT') return;
    if (code !== 0) {
      console.log(`Server exited with code ${code}. Waiting for changes to restart...`);
    }
  });
};

const scheduleRestart = () => {
  if (restartTimer) return;
  restartTimer = setTimeout(() => {
    restartTimer = null;
    console.log('Change detected. Restarting server...');
    startServer();
  }, 100);
};

fs.watchFile(serverFile, { interval: 500 }, (curr, prev) => {
  if (curr.mtimeMs !== prev.mtimeMs) {
    scheduleRestart();
  }
});

fs.watchFile(envFile, { interval: 500 }, (curr, prev) => {
  if (curr.mtimeMs !== prev.mtimeMs) {
    scheduleRestart();
  }
});

process.on('SIGINT', () => {
  if (serverProcess) serverProcess.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (serverProcess) serverProcess.kill('SIGTERM');
  process.exit(0);
});

startServer();
