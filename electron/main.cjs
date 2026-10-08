const fs = require('fs');
const http = require('http');
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');

const { execSync, spawn, exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const os = require('os');

let runServerPort = null;

const chokidar = require('chokidar');

// --- SECURITY HELPERS ---------------------------------------------------------
function validateSafePath(p) {
  if (typeof p !== 'string' || p.includes('\0')) throw new Error("Invalid path format.");
  const normalized = path.normalize(p);
  if (p.includes('..') && !normalized.includes('..')) {
      // Path traversal attempt
      throw new Error("Path traversal is not allowed.");
  }
  return p;
}
// ------------------------------------------------------------------------------


let mainWindow;
let currentWatcher = null;

async function readDirectoryRecursive(dirPath) {
  try {
    const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
    
    // Process all items concurrently
    const nodePromises = items.map(async (item) => {
      if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === 'dist-electron' || item.name === 'dist' || item.name === 'build' || item.name === 'target') return null;

      const fullPath = path.join(dirPath, item.name);
      if (item.isDirectory()) {
        return {
          name: item.name,
          type: 'dir',
          path: fullPath,
          children: await readDirectoryRecursive(fullPath),
        };
      } else {
        const ext = item.name.split('.').pop() || '';
        return {
          name: item.name,
          type: 'file',
          path: fullPath,
          lang: ext,
        };
      }
    });

    const nodes = (await Promise.all(nodePromises)).filter(Boolean);

    nodes.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'dir' ? -1 : 1;
    });

    return nodes;
  } catch (e) {
    return [];
  }
}

async function searchInDir(dirPath, query, results = []) {
  try {
    const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const item of items) {
      if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === 'dist-electron' || item.name === 'dist' || item.name === 'build' || item.name === 'target') continue;
      const fullPath = path.join(dirPath, item.name);
      if (item.isDirectory()) {
        await searchInDir(fullPath, query, results);
      } else {
        try {
          const content = await fs.promises.readFile(fullPath, 'utf-8');
          if (content.toLowerCase().includes(query.toLowerCase())) {
            const lines = content.split('\n');
            lines.forEach((line, index) => {
              if (line.toLowerCase().includes(query.toLowerCase())) {
                results.push({
                  fileName: item.name,
                  filePath: fullPath,
                  lineNumber: index + 1,
                  lineContent: line.trim(),
                });
              }
            });
          }
        } catch (e) {
          // ignore unreadable files
        }
      }
    }
  } catch (e) {
    // ignore unreadable dirs
  }
  return results;
}

// ─── TYPESCRIPT BACKGROUND WATCHER (PROJECT-WIDE PROBLEMS) ────────────────────
let tsWatcherProcess = null;

ipcMain.on('start-ts-watcher', (event, folderPath) => {
  if (tsWatcherProcess) {
    tsWatcherProcess.kill();
    tsWatcherProcess = null;
  }
  if (!folderPath) return;

  const fs = require('fs');
  const path = require('path');
  const tsconfigPath = path.join(folderPath, 'tsconfig.json');
  
  if (!fs.existsSync(tsconfigPath)) {
    event.sender.send('ts-problems', []);
    return;
  }

  const { spawn } = require('child_process');
  const os = require('os');
  const npx = os.platform() === 'win32' ? 'npx.cmd' : 'npx';

  tsWatcherProcess = spawn(npx, ['tsc', '--noEmit', '--watch'], { cwd: folderPath });

  let problems = [];

  tsWatcherProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    let hasNewErrors = false;

    lines.forEach(line => {
      // Clear problems on "Starting compilation..."
      if (line.includes('Starting compilation') || line.includes('File change detected')) {
        problems = [];
        hasNewErrors = true;
      }
      
      // Parse TS errors: src/app/App.tsx(10,5): error TS1005: message
      const match = line.match(/(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)/);
      if (match) {
        problems.push({
          file: path.basename(match[1]),
          fullPath: path.resolve(folderPath, match[1]),
          startLine: parseInt(match[2], 10),
          startColumn: parseInt(match[3], 10),
          severity: match[4] === 'error' ? 'error' : 'warning',
          source: match[5],
          message: match[6]
        });
        hasNewErrors = true;
      }

      // Send when compilation completes
      if (line.includes('Found') && line.includes('errors. Watching for file changes')) {
        event.sender.send('ts-problems', problems);
      }
    });
  });

  tsWatcherProcess.on('exit', () => {
    tsWatcherProcess = null;
  });
});

ipcMain.on('stop-ts-watcher', () => {
  if (tsWatcherProcess) {
    tsWatcherProcess.kill();
    tsWatcherProcess = null;
  }
});

// ─── TERMINAL INTEGRATION (NODE-PTY) ───────────────────────────────────────────────
let ptyProcess = null;

ipcMain.on('start-terminal', (event, folderPath) => {
  if (ptyProcess) return;
  const os = require('os');
  try {
    const pty = require('node-pty');
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: folderPath || process.env.USERPROFILE || process.cwd(),
      env: process.env
    });

    ptyProcess.onData((data) => {
      event.sender.send('terminal-data', data);
    });

    ptyProcess.onExit(() => {
      ptyProcess = null;
      event.sender.send('terminal-data', '\r\n\x1b[31m[Terminal Process Exited]\x1b[0m\r\n');
    });
  } catch (err) {
    event.sender.send('terminal-data', `\r\n\x1b[31m[PTY Error]: Failed to start terminal.\r\n${err.message}\x1b[0m\r\n`);
  }
});

ipcMain.on('write-terminal', (event, data) => {
  if (ptyProcess) {
    ptyProcess.write(data);
  }
});

ipcMain.on('resize-terminal', (event, cols, rows) => {
  if (ptyProcess) {
    try {
      ptyProcess.resize(cols, rows);
    } catch (e) { /* ignore */ }
  }
});


let splashWindow;

function createWindow() {
  splashWindow = new BrowserWindow({
    width: 600,
    height: 400,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  splashWindow.loadFile(path.join(__dirname, '../splash/index.html'));

  mainWindow = new BrowserWindow({ show: false,
    width: 1280,
    height: 800,
    frame: false, // Make window frameless for a premium, custom titlebar
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
    autoHideMenuBar: true,
    backgroundColor: '#0d0e12',
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // show handled by timeout
    mainWindow.webContents.openDevTools();
      } else {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
      mainWindow.webContents.on('console-message', (e, level, msg, line) => console.log('RENDERER:', msg, 'Line:', line));
    }
    
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
      }
    }, 4000);

}

// IPC Handlers




let runServer = null;
let currentRunFolder = null;
let runProcesses = []; // Track spawned build processes
let buildOutput = []; // Collect build output lines

// ─── SMART PROJECT DETECTION ───────────────────────────────────────────────────
function detectProjectType(folderPath) {
  const checks = [
    { files: ['pubspec.yaml'], type: 'flutter', label: 'Flutter / Dart', icon: '💙', color: '#02569B',
      commands: [
        { label: 'Run in iPhone Simulator (Hot Reload)', cmd: '__OPEN_SIMULATOR__' },
        { label: 'See Application (Windows Desktop)', cmd: 'flutter run -d windows' },
        { label: 'See Application (Web Browser)', cmd: 'flutter run -d chrome || flutter run -d edge' },
        { label: 'Build APK', cmd: 'flutter build apk' },
        { label: 'Clean Project', cmd: 'flutter clean' },
      ]},
    { files: ['build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts'], type: 'android', label: 'Android (Gradle)', icon: '🤖', color: '#3DDC84',
      commands: [
        { label: 'Build APK (Debug)', cmd: process.platform === 'win32' ? 'gradlew.bat assembleDebug' : './gradlew assembleDebug' },
        { label: 'Install on Device', cmd: process.platform === 'win32' ? 'gradlew.bat installDebug' : './gradlew installDebug' },
        { label: 'Clean Project', cmd: process.platform === 'win32' ? 'gradlew.bat clean' : './gradlew clean' },
      ]},
    { files: ['package.json'], type: 'node', label: 'Node.js / Web', icon: '⬡', color: '#68A063',
      commands: [
        { label: 'Install Dependencies', cmd: 'npm install' },
        { label: 'Dev Server', cmd: 'npm run dev' },
        { label: 'Build', cmd: 'npm run build' },
      ]},
    { files: ['requirements.txt', 'setup.py', 'pyproject.toml'], type: 'python', label: 'Python', icon: '🐍', color: '#3776AB',
      commands: [
        { label: 'Run main.py', cmd: 'python main.py' },
        { label: 'Install Requirements', cmd: 'pip install -r requirements.txt' },
      ]},
    { files: ['Cargo.toml'], type: 'rust', label: 'Rust', icon: '🦀', color: '#DEA584',
      commands: [
        { label: 'Build', cmd: 'cargo build' },
        { label: 'Run', cmd: 'cargo run' },
      ]},
    { files: ['go.mod'], type: 'go', label: 'Go', icon: '🐹', color: '#00ADD8',
      commands: [
        { label: 'Run', cmd: 'go run .' },
        { label: 'Build', cmd: 'go build' },
      ]},
  ];

  for (const check of checks) {
    for (const file of check.files) {
      // Check both root and common subdirectories
      if (fs.existsSync(path.join(folderPath, file))) {
        return { type: check.type, label: check.label, icon: check.icon, color: check.color, commands: check.commands };
      }
      // Check one level deep for monorepos
      try {
        const items = fs.readdirSync(folderPath, { withFileTypes: true });
        for (const item of items) {
          if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
            if (fs.existsSync(path.join(folderPath, item.name, file))) {
              return { type: check.type, label: check.label, icon: check.icon, color: check.color, commands: check.commands, subdir: item.name };
            }
          }
        }
      } catch (e) { /* ignore */ }
    }
  }

  // Check for any HTML files as fallback
  try {
    const files = fs.readdirSync(folderPath);
    if (files.some(f => f.toLowerCase().endsWith('.html'))) {
      return { type: 'static', label: 'Static HTML', icon: '🌐', color: '#E44D26', commands: [] };
    }
  } catch (e) { /* ignore */ }

  return { type: 'unknown', label: 'Unknown Project', icon: '📁', color: '#9999b0', commands: [] };
}

// --- Simulator Static File Server ---
  let simulatorServer = null;
  function startSimulatorStaticServer(webDir, port) {
    const fs = require('fs');
    const http = require('http');
    if (simulatorServer) { try { simulatorServer.close(); } catch(e) {} }
    simulatorServer = http.createServer((req2, res2) => {
      const url = require('url');
      let reqPath = url.parse(req2.url).pathname;
      if (reqPath === '/') reqPath = '/index.html';
      const filePath = path.join(webDir, reqPath);
      const extname = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
        '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
        '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
        '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
        '.wasm': 'application/wasm',
      };
      const corsHeaders = { 
        'Access-Control-Allow-Origin': '*', 
        'Access-Control-Allow-Methods': 'GET',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      };
      if (req2.method === 'OPTIONS') { res2.writeHead(204, corsHeaders); res2.end(); return; }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          // SPA fallback: serve index.html for unknown paths
          fs.readFile(path.join(webDir, 'index.html'), (err2, data2) => {
            if (err2) { res2.writeHead(404, corsHeaders); res2.end('Not Found'); return; }
            res2.writeHead(200, { 'Content-Type': 'text/html', ...corsHeaders });
            res2.end(data2);
          });
          return;
        }
        res2.writeHead(200, { 'Content-Type': mimeTypes[extname] || 'application/octet-stream', ...corsHeaders });
        if (reqPath === '/flutter_bootstrap.js') {
          let jsStr = data.toString();
          jsStr = jsStr.replace('_flutter.loader.load({', '_flutter.loader.load({\n  config: { renderer: "canvaskit" },');
          res2.end(jsStr);
        } else if (reqPath === '/index.html') {
          let html = data.toString();
          // Inject cache-buster to prevent webview from loading broken cached versions
          html = html.replace('"flutter_bootstrap.js"', `"flutter_bootstrap.js?t=${Date.now()}"`);
          // Also inject legacy window variable just in case
          html = html.replace('<head>', '<head>\n  <script>window.flutterWebRenderer = "canvaskit";</script>');
          res2.end(html);
        } else {
          res2.end(data);
        }
      });
    });
    simulatorServer.listen(port, '127.0.0.1', () => {
      if (global.simulatorOutput) global.simulatorOutput.push({ type: 'stdout', text: 'App ready on http://127.0.0.1:' + port });
    });
    simulatorServer.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        // Port already in use, just mark as ready
        if (global.simulatorOutput) global.simulatorOutput.push({ type: 'stdout', text: 'Port ' + port + ' already serving.' });
      }
    });
  }

  function generateSmartDashboard(folderPath, projectInfo, autorun = false, simulator = false) {
  const folderName = path.basename(folderPath);
  // If project is inside a subdirectory (monorepo), use that as the actual root
  const actualProjectPath = projectInfo && projectInfo.subdir ? path.join(folderPath, projectInfo.subdir) : folderPath;

  if (simulator) {
    // Read the app's real icon for the home screen (base64 embedded)
    const fs2 = require('fs');
    const iconCandidates = [
      // Custom project logos first (highest priority)
      path.join(actualProjectPath, 'LOCAL_SHARE_LOGO.PNG'),
      path.join(actualProjectPath, 'assets', 'icon.png'),
      path.join(actualProjectPath, 'assets', 'logo.png'),
      path.join(actualProjectPath, 'assets', 'app_icon.png'),
      // Android icons (usually customized by developers)
      path.join(actualProjectPath, 'android', 'app', 'src', 'main', 'res', 'mipmap-xxxhdpi', 'ic_launcher.png'),
      path.join(actualProjectPath, 'android', 'app', 'src', 'main', 'res', 'mipmap-xxhdpi', 'ic_launcher.png'),
      // iOS icon
      path.join(actualProjectPath, 'ios', 'Runner', 'Assets.xcassets', 'AppIcon.appiconset', 'Icon-App-1024x1024@1x.png'),
      // Web icons (often still defaults, check size)
      path.join(actualProjectPath, 'web', 'icons', 'Icon-512.png'),
      path.join(actualProjectPath, 'web', 'icons', 'Icon-192.png'),
      path.join(actualProjectPath, 'web', 'icons', 'Icon-maskable-192.png'),
      path.join(actualProjectPath, 'web', 'favicon.png'),
    ];
    let appIconBase64 = '';
    const FLUTTER_DEFAULT_SIZES = [5292, 917, 8252]; // known default icon sizes
    for (const ic of iconCandidates) {
      try {
        if (fs2.existsSync(ic)) {
          const stat = fs2.statSync(ic);
          // Skip tiny files that are likely Flutter defaults (< 6KB for 192px icons)
          if (stat.size < 6000 && ic.includes('web')) continue;
          const buf = fs2.readFileSync(ic);
          appIconBase64 = 'data:image/png;base64,' + buf.toString('base64');
          break;
        }
      } catch(e) {}
    }
    const iconImgTag = appIconBase64
      ? '<img src="' + appIconBase64 + '" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;z-index:2;" />'
      : '<span style="font-size:28px;">' + (projectInfo.icon || '') + '</span>';
    const iconSmallTag = appIconBase64
      ? '<img src="' + appIconBase64 + '" style="width:100%;height:100%;object-fit:cover;" />'
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>iPhone Simulator</title>
  <style>
    body {
      margin: 0; padding: 0; overflow: hidden;
      background: linear-gradient(145deg, #1a0533 0%, #2d1b69 25%, #e91e8c 50%, #ff9a56 70%, #00d4aa 100%);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      height: 100vh; display: flex; flex-direction: column; user-select: none;
    }
    .status-bar { height: 44px; }
    .app-grid {
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: 18px; padding: 20px 24px;
    }
    .app-icon-wrapper {
      display: flex; flex-direction: column; align-items: center; gap: 5px;
      cursor: pointer; transition: transform 0.1s;
    }
    .app-icon-wrapper:active { transform: scale(0.9); }
    .app-icon {
      width: 60px; height: 60px; background: #fff; border-radius: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center;
      position: relative; overflow: hidden;
    }
    .app-name {
      color: #fff; font-size: 11px; font-weight: 500;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      max-width: 68px; text-align: center;
    }
    /* Build progress overlay - iOS style bottom sheet */
    .build-overlay {
      display: none; position: fixed; bottom: 0; left: 0; right: 0;
      background: rgba(0,0,0,0.85); backdrop-filter: blur(20px);
      padding: 14px 18px 18px; z-index: 100;
      border-radius: 16px 16px 0 0;
      flex-direction: column; gap: 8px;
    }
    .build-header { display: flex; align-items: center; gap: 10px; }
    .build-app-icon {
      width: 36px; height: 36px; border-radius: 8px; overflow: hidden;
      background: #333; flex-shrink: 0;
    }
    .build-app-icon img { width: 100%; height: 100%; object-fit: cover; }
    .build-title { color: #fff; font-size: 13px; font-weight: 600; }
    .build-status { color: #888; font-size: 11px; margin-top: 1px; }
    .progress-track {
      width: 100%; height: 4px; background: rgba(255,255,255,0.1);
      border-radius: 4px; overflow: hidden; margin-top: 4px;
    }
    .progress-bar {
      height: 100%; width: 0%; border-radius: 4px;
      background: linear-gradient(90deg, #34C759, #30D158);
      transition: width 0.5s ease;
    }
    .progress-bar.error { background: #ff3b30; }
  </style>
</head>
<body>
  <div class="status-bar"></div>
  <div class="app-grid">
    <div class="app-icon-wrapper" onclick="startApp()">
      <div class="app-icon">
        ${iconImgTag}
      </div>
      <div class="app-name">${folderName}</div>
    </div>
  </div>

  <!-- Build progress overlay -->
  <div class="build-overlay" id="buildOverlay">
    <div class="build-header">
      <div class="build-app-icon">${iconSmallTag}</div>
      <div>
        <div class="build-title">${folderName}</div>
        <div class="build-status" id="buildStatus">Preparing...</div>
      </div>
    </div>
    <div class="progress-track">
      <div class="progress-bar" id="progressBar"></div>
    </div>
  </div>

  <script>
    let isCompiling = false;
    const stages = [
      { match: 'Found cached build', pct: 95 },
      { match: 'Serving instantly', pct: 98 },
      { match: 'Resolving dependencies', pct: 10 },
      { match: 'Got dependencies', pct: 20 },
      { match: 'Compiling', pct: 35 },
      { match: 'lib/main.dart', pct: 50 },
      { match: 'Compiled', pct: 75 },
      { match: 'Build successful', pct: 90 },
      { match: 'App ready', pct: 100 },
    ];

    function updateProgress(text) {
      const statusEl = document.getElementById('buildStatus');
      const barEl = document.getElementById('progressBar');
      const cur = parseFloat(barEl.style.width) || 0;
      for (const s of stages) {
        if (text.includes(s.match) && s.pct > cur) {
          barEl.style.width = s.pct + '%';
        }
      }
      // Gentle auto-increment
      const cur2 = parseFloat(barEl.style.width) || 0;
      if (cur2 < 85 && cur2 > 0) {
        barEl.style.width = Math.min(cur2 + 0.3, 85) + '%';
      }
      if (text.trim()) {
        statusEl.textContent = text.length > 45 ? text.substring(0, 45) + '...' : text;
      }
    }

    function startApp() {
      if (isCompiling) return;
      isCompiling = true;
      document.getElementById('buildOverlay').style.display = 'flex';
      document.getElementById('progressBar').style.width = '2%';

      let cmd = 'npm run dev';
      if ('${projectInfo.type}' === 'flutter') {
        cmd = 'flutter build web';
      }

      fetch('/__api/simulator-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd: cmd })
      }).catch(e => console.error(e));

      const evtSource = new EventSource('/__api/simulator-output');
      evtSource.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'stdout' || data.type === 'stderr') {
          updateProgress(data.text);
        } else if (data.type === 'exit' && data.code !== 0) {
          document.getElementById('progressBar').classList.add('error');
          document.getElementById('progressBar').style.width = '100%';
          document.getElementById('buildStatus').textContent = 'Build Failed (Code ' + data.code + ')';
          clearTimeout(checkReady);
          evtSource.close();
          isCompiling = false;
        }
      };

      const port = '${projectInfo.type}' === 'flutter' ? '8442' : '3000';
      let checkReady;
      const poll = async () => {
        if (!isCompiling) return;
        try {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 2000);
          const res = await fetch('http://127.0.0.1:' + port, { signal: controller.signal });
          clearTimeout(tid);
          if (res.ok || res.status === 200 || res.status === 404) {
            document.getElementById('progressBar').style.width = '100%';
            document.getElementById('buildStatus').textContent = 'Opening...';
            evtSource.close();
            setTimeout(() => { window.location.href = 'http://127.0.0.1:' + port; }, 400);
            return;
          }
        } catch(e) {}
        checkReady = setTimeout(poll, 1500);
      };
      poll();
    }
  </script>
</body>
</html>`;
  }
  const commandButtons = projectInfo.commands.map((cmd, i) => `
    <button onclick="runCmd('${cmd.cmd.replace(/'/g, "\\'")}')" class="cmd-btn" id="cmd-${i}">
      <span class="cmd-icon">▶</span>
      <div class="cmd-info">
        <span class="cmd-label">${cmd.label}</span>
        <code class="cmd-text">${cmd.cmd}</code>
      </div>
    </button>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Run Studio — ${folderName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
          ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.3); border-radius: 4px; }
      body {
        overflow: hidden;
        margin: 0;
        background: #0d0e12;
        color: #c8c8d4;
        font-family: 'Outfit', sans-serif;
        height: 100vh;
        display: flex;
        flex-direction: column;
      }
    .header {
      padding: 32px 28px 20px;
      border-bottom: 1px solid rgba(212,175,55,0.1);
    }
    .project-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      background: ${projectInfo.color}15;
      color: ${projectInfo.color};
      border: 1px solid ${projectInfo.color}30;
      margin-bottom: 14px;
    }
    .project-name {
      font-size: 22px;
      font-weight: 700;
      color: #e8e8f0;
      margin-bottom: 4px;
    }
    .project-path {
      font-size: 11px;
      color: #5a5a70;
      font-family: 'JetBrains Mono', monospace;
      word-break: break-all;
    }
    .commands-section {
      padding: 20px 28px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 600;
      color: #6b6b80;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin-bottom: 12px;
    }
    .cmd-btn {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 12px 16px;
      margin-bottom: 8px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: left;
      color: #c8c8d4;
      font-family: 'Outfit', sans-serif;
    }
    .cmd-btn:hover {
      background: ${projectInfo.color}12;
      border-color: ${projectInfo.color}40;
      transform: translateY(-1px);
    }
    .cmd-btn:active { transform: translateY(0); }
    .cmd-btn.running {
      border-color: ${projectInfo.color}60;
      background: ${projectInfo.color}10;
    }
    .cmd-icon {
      font-size: 16px;
      color: ${projectInfo.color};
      width: 24px;
      text-align: center;
      flex-shrink: 0;
    }
    .cmd-info { display: flex; flex-direction: column; gap: 2px; }
    .cmd-label { font-size: 13px; font-weight: 500; }
    .cmd-text {
      font-size: 11px;
      color: #5a5a70;
      font-family: 'JetBrains Mono', monospace;
    }
    .output-section {
      flex: 1;
      padding: 0 28px 20px;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .output-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .output-box {
      flex: 1;
      background: #090a0d;
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 8px;
      padding: 12px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      line-height: 1.6;
      overflow-y: auto;
      color: #7a7a90;
      min-height: 120px;
    }
    .output-box .line { white-space: pre-wrap; word-break: break-all; }
    .output-box .line.error { color: #f48771; }
    .output-box .line.success { color: #4ec9b0; }
    .output-box .line.info { color: #569cd6; }
    .status-dot {
      width: 8px; height: 8px; border-radius: 50%;
      display: inline-block; margin-right: 6px;
    }
    .status-dot.idle { background: #6b6b80; }
    .status-dot.running { background: ${projectInfo.color}; animation: pulse 1.5s infinite; }
    .status-dot.done { background: #4ec9b0; }
    .status-dot.error { background: #f48771; }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    .clear-btn {
      background: none;
      border: 1px solid rgba(255,255,255,0.08);
      color: #6b6b80;
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-family: 'Outfit', sans-serif;
    }
    .clear-btn:hover { color: #c8c8d4; border-color: rgba(255,255,255,0.15); }
    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: #4a4a60;
    }
    .empty-state svg { margin-bottom: 12px; opacity: 0.4; }
    .stop-btn {
      background: #f4877120;
      border: 1px solid #f4877140;
      color: #f48771;
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-family: 'Outfit', sans-serif;
      margin-left: 6px;
    }
    .stop-btn:hover { background: #f4877130; }
  </style>
</head>
<body>
  <div class="header">
    <div class="project-badge">
      <span>${projectInfo.icon}</span>
      <span>${projectInfo.label}</span>
    </div>
    <div class="project-name">${folderName}</div>
    <div class="project-path">${folderPath.replace(/\\/g, '/')}</div>
  </div>

  <div class="commands-section">
    <div class="section-title">Build & Run Commands</div>
    ${commandButtons}
  </div>

  <div class="output-section">
    <div class="output-header">
      <div class="section-title" style="margin-bottom:0">
        <span class="status-dot idle" id="statusDot"></span>
        <span id="statusText">Output</span>
      </div>
      <div>
        <button class="stop-btn" id="stopBtn" style="display:none" onclick="stopCmd()">■ Stop</button>
        <button class="clear-btn" onclick="clearOutput()">Clear</button>
      </div>
    </div>
    <div class="output-box" id="output">
      <div class="empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
        <div style="font-size:13px">Click a command above to start</div>
      </div>
    </div>
  </div>

  <script>
    const output = document.getElementById('output');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const stopBtn = document.getElementById('stopBtn');
    let evtSource = null;
    let isRunning = false;

    function addLine(text, type) {
      if (output.querySelector('.empty-state')) output.innerHTML = '';
      const div = document.createElement('div');
      div.className = 'line' + (type ? ' ' + type : '');
      div.textContent = text;
      output.appendChild(div);
      output.scrollTop = output.scrollHeight;
    }

    function setStatus(status, text) {
      statusDot.className = 'status-dot ' + status;
      statusText.textContent = text || 'Output';
      stopBtn.style.display = status === 'running' ? 'inline-block' : 'none';
      isRunning = status === 'running';
    }

    function clearOutput() {
      output.innerHTML = '<div class="empty-state"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg><div style="font-size:13px">Click a command above to start</div></div>';
      setStatus('idle', 'Output');
    }

    function stopCmd() {
      fetch('/__api/stop', { method: 'POST' });
      setStatus('idle', 'Stopped');
      addLine('\\n--- Process stopped ---', 'info');
    }

    function runCmd(cmd) {
      if (isRunning) {
        if (!confirm('A process is already running. Stop it and run this command?')) return;
        fetch('/__api/stop', { method: 'POST' });
      }
      if (evtSource) { evtSource.close(); evtSource = null; }

      output.innerHTML = '';
      addLine('$ ' + cmd, 'info');
      addLine('', '');
      setStatus('running', 'Running: ' + cmd);

      fetch('/__api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd })
      });

      evtSource = new EventSource('/__api/output');
      evtSource.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'stdout') addLine(data.text, '');
        else if (data.type === 'stderr') addLine(data.text, 'error');
        else if (data.type === 'exit') {
          const code = data.code;
          if (code === 0) {
            addLine('\\n✓ Process exited with code 0', 'success');
            setStatus('done', 'Completed successfully');
          } else {
            addLine('\\n✗ Process exited with code ' + code, 'error');
            setStatus('error', 'Failed (exit code ' + code + ')');
          }
          evtSource.close();
          evtSource = null;
        }
      };
      evtSource.onerror = () => {
        if (evtSource) { evtSource.close(); evtSource = null; }
      };
    }
  </script>

  <script>
      if (${autorun} && '${projectInfo.type}' !== 'android') {
        setTimeout(() => {
          const firstCmd = document.getElementById('cmd-0');
          if (firstCmd) firstCmd.click();
        }, 300);
      }
    </script>

</body>
</html>`;
}

ipcMain.handle('serve-folder', (event, folderPath) => {
  currentRunFolder = folderPath;
  buildOutput = [];
  runProcesses.forEach(p => { try { p.kill(); } catch(e) {} });
  runProcesses = [];

  if (!runServer) {
    runServer = http.createServer((req, res) => {
      if (!currentRunFolder) {
        res.writeHead(404);
        return res.end('No folder served');
      }

      const parsedUrl = new URL(req.url, 'http://localhost');
      const cleanUrl = parsedUrl.pathname;

      // ─── API: Flutter Devices ──────────────────────────────────────────────
      if (cleanUrl === '/__api/flutter_devices' && req.method === 'GET') {
        const { exec } = require('child_process');
        exec('flutter devices --machine', (error, stdout, stderr) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          if (error) {
            res.end(JSON.stringify([]));
          } else {
            res.end(stdout);
          }
        });
        return;
      }

      // ─── API: Run a command ───────────────────────────────────────────────
      // --- API: Simulator Run (smart: serve cached build or build-then-serve) ---
      if (cleanUrl === '/__api/simulator-run' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const { cmd } = JSON.parse(body);
            const fs = require('fs');
            const projectInfo = detectProjectType(currentRunFolder);
            const actualProjectPath = projectInfo && projectInfo.subdir ? path.join(currentRunFolder, projectInfo.subdir) : currentRunFolder;
            const buildWebPath = path.join(actualProjectPath, 'build', 'web');
            const indexPath = path.join(buildWebPath, 'index.html');
            
            // Kill only the simulator process, not the main run
            if (global.simulatorProc) { try { global.simulatorProc.kill(); } catch(e) {} }
            global.simulatorOutput = [];

            // Check if build/web/index.html already exists (cached build)
            if (fs.existsSync(indexPath)) {
              global.simulatorOutput.push({ type: 'stdout', text: 'Found cached build! Serving instantly...' });
              // Start a simple static server on port 8442
              startSimulatorStaticServer(buildWebPath, 8442);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, cached: true }));
              return;
            }

            // No cached build - run flutter build web
            const buildCmd = 'flutter build web';
            global.simulatorOutput.push({ type: 'stdout', text: 'No cached build found. Building...' });
            global.simulatorOutput.push({ type: 'stdout', text: 'RUNNING: ' + buildCmd });
            global.simulatorOutput.push({ type: 'stdout', text: 'Working directory: ' + actualProjectPath });

            global.simulatorProc = spawn(buildCmd, [], {
              cwd: actualProjectPath,
              shell: true,
              env: { ...process.env, FORCE_COLOR: '0' }
            });

            global.simulatorProc.stdout.on('data', (data) => {
              data.toString().split('\n').forEach(line => {
                if (line.trim()) global.simulatorOutput.push({ type: 'stdout', text: line });
              });
            });
            global.simulatorProc.stderr.on('data', (data) => {
              data.toString().split('\n').forEach(line => {
                if (line.trim()) global.simulatorOutput.push({ type: 'stderr', text: line });
              });
            });
            global.simulatorProc.on('close', (code) => {
              if (code === 0 && fs.existsSync(indexPath)) {
                global.simulatorOutput.push({ type: 'stdout', text: 'Build successful! Serving app...' });
                  startSimulatorStaticServer(buildWebPath, 8442);
              } else {
                global.simulatorOutput.push({ type: 'exit', code });
              }
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, cached: false }));
          } catch(e) {
            res.writeHead(400); res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      // --- API: Simulator SSE output stream ---
      if (cleanUrl === '/__api/simulator-output') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });
        if (!global.simulatorOutput) global.simulatorOutput = [];
        let lastIdx = 0;
        const interval = setInterval(() => {
          while (lastIdx < (global.simulatorOutput || []).length) {
            res.write('data: ' + JSON.stringify(global.simulatorOutput[lastIdx]) + '\n\n');
            lastIdx++;
          }
        }, 300);
        req.on('close', () => clearInterval(interval));
        return;
      }

            if (cleanUrl === '/__api/run' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
                          const { cmd } = JSON.parse(body);
              if (cmd === '__OPEN_SIMULATOR__') {
                if (mainWindow) mainWindow.webContents.send('trigger-simulator');
                // Push a clean exit so Run Studio UI doesn't hang
                buildOutput.push({ type: 'stdout', text: 'Opening Simulator...' });
                buildOutput.push({ type: 'exit', code: 0 });
                res.writeHead(200); res.end(); return;
              }
            // Kill any existing build process
            runProcesses.forEach(p => { try { p.kill(); } catch(e) {} });
            runProcesses = [];
            buildOutput = [];

            const proc = spawn(cmd, [], {
              cwd: currentRunFolder,
              shell: true,
              env: { ...process.env, FORCE_COLOR: '0' }
            });
            runProcesses.push(proc);

            proc.stdout.on('data', (data) => {
              const lines = data.toString().split('\n');
              lines.forEach(line => {
                if (line.trim()) buildOutput.push({ type: 'stdout', text: line });
              });
            });
            proc.stderr.on('data', (data) => {
              const lines = data.toString().split('\n');
              lines.forEach(line => {
                if (line.trim()) buildOutput.push({ type: 'stderr', text: line });
              });
            });
            proc.on('close', (code) => {
              buildOutput.push({ type: 'exit', code: code === null ? -1 : code });
              runProcesses = runProcesses.filter(p => p !== proc);
            });
            proc.on('error', (err) => {
              buildOutput.push({ type: 'stderr', text: err.message });
              buildOutput.push({ type: 'exit', code: 1 });
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      // ── API: Stop running process ─────────────────────────────
      if (cleanUrl === '/__api/stop' && req.method === 'POST') {
        runProcesses.forEach(p => { try { p.kill(); } catch(e) {} });
        runProcesses = [];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      // ── API: SSE output stream ────────────────────────────────
      if (cleanUrl === '/__api/output') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });

        let sentIndex = 0;
        const interval = setInterval(() => {
          while (sentIndex < buildOutput.length) {
            const entry = buildOutput[sentIndex];
            res.write(`data: ${JSON.stringify(entry)}\n\n`);
            sentIndex++;
            // If we sent an exit event, stop polling
            if (entry.type === 'exit') {
              clearInterval(interval);
              res.end();
              return;
            }
          }
        }, 100);

        req.on('close', () => clearInterval(interval));
        return;
      }

      // ── Static file serving ───────────────────────────────────
      let filePath;
      if (cleanUrl === '/') {
        // Check if index.html exists
        const indexPath = path.join(currentRunFolder, 'index.html');
        if (fs.existsSync(indexPath)) {
          filePath = indexPath;
        } else {
          // No index.html → show Smart Dashboard
          const projectInfo = detectProjectType(currentRunFolder);
          const autorun = parsedUrl.searchParams.get('autorun') === 'true';
          const simulator = parsedUrl.searchParams.get('simulator') === 'true';
          const dashboard = generateSmartDashboard(currentRunFolder, projectInfo, autorun, simulator);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(dashboard);
          return;
        }
      } else {
        filePath = path.join(currentRunFolder, cleanUrl);
      }
      
      const extname = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html', '.htm': 'text/html',
        '.js': 'text/javascript', '.mjs': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
        '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
        '.mp4': 'video/mp4', '.webm': 'video/webm',
        '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
        '.xml': 'application/xml', '.txt': 'text/plain',
        '.map': 'application/json',
      };
      const contentType = mimeTypes[extname] || 'application/octet-stream';
      
      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found: ' + cleanUrl);
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content);
        }
      });
    });
    runServer.on('error', (err) => {
      console.error('Run server error:', err);
    });
    return new Promise((resolve) => {
      runServer.listen(0, '127.0.0.1', () => {
        runServerPort = runServer.address().port;
        console.log('Run server listening on ' + runServerPort);
        resolve(runServerPort);
      });
    });
  }
  return runServerPort;
});

  ipcMain.handle('save-file-dialog', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save File',
    filters: [
      { name: 'HTML (*.html; *.htm)', extensions: ['html', 'htm'] },
      { name: 'JavaScript (*.js; *.jsx)', extensions: ['js', 'jsx'] },
      { name: 'TypeScript (*.ts; *.tsx)', extensions: ['ts', 'tsx'] },
      { name: 'CSS (*.css)', extensions: ['css'] },
      { name: 'JSON (*.json)', extensions: ['json'] },
      { name: 'Markdown (*.md)', extensions: ['md'] },
      { name: 'All Files (*.*)', extensions: ['*'] }
    ]
  });
  if (result.canceled) return null;
  return result.filePath;
});

ipcMain.handle('new-window', () => {
  createWindow();
});

ipcMain.handle('toggle-devtools', (event) => {
  event.sender.toggleDevTools();
});

ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openFile'] });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('read-dir', async (event, folderPath) => {
  folderPath = validateSafePath(folderPath);
  return readDirectoryRecursive(folderPath);
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    filePath = validateSafePath(filePath);
    return await fs.promises.readFile(filePath, 'utf-8');
  } catch (e) {
    return `Error reading file: ${e.message}`;
  }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    filePath = validateSafePath(filePath);
    await fs.promises.writeFile(filePath, content, 'utf-8');
    return true;
  } catch (e) {
    throw new Error(`Failed to save file: ${e.message}`);
  }
});

ipcMain.handle('create-file', async (event, filePath) => {
  try {
    filePath = validateSafePath(filePath);
    await fs.promises.writeFile(filePath, '', 'utf-8');
    return true;
  } catch (e) {
    throw new Error(`Failed to create file: ${e.message}`);
  }
});

ipcMain.handle('create-dir', async (event, dirPath) => {
  try {
    dirPath = validateSafePath(dirPath);
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
  } catch (e) {
    throw new Error(`Failed to create directory: ${e.message}`);
  }
});

ipcMain.handle('delete-path', async (event, pathToRemove) => {
  try {
    pathToRemove = validateSafePath(pathToRemove);
    fs.rmSync(pathToRemove, { recursive: true, force: true });
    return true;
  } catch (e) {
    throw new Error(`Failed to delete: ${e.message}`);
  }
});

ipcMain.handle('rename-path', async (event, oldPath, newPath) => {
  try {
    oldPath = validateSafePath(oldPath);
    newPath = validateSafePath(newPath);
    fs.renameSync(oldPath, newPath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});


// ─── COMPUTER USE (OS AGENT) ────────────────────────────────────────────────
const { desktopCapturer } = require('electron');

// 1. Vision: Take Screenshot
ipcMain.handle('take-screenshot', async () => {
  try {
    const sources = await desktopCapturer.getSources({ 
      types: ['screen'], 
      thumbnailSize: { width: 1920, height: 1080 } 
    });
    if (sources.length > 0) {
      return sources[0].thumbnail.toDataURL(); // returns "data:image/png;base64,..."
    }
    return null;
  } catch (e) {
    console.error("Screenshot error:", e);
    return null;
  }
});

// 2. Action: Mouse & Keyboard via PowerShell (Zero dependencies)
ipcMain.handle('os-action', async (event, action, params) => {
  const { exec } = require('child_process');
  
  return new Promise((resolve) => {
    let psScript = `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing
      $code = @"
      using System;
      using System.Runtime.InteropServices;
      public class OS {
          [DllImport("user32.dll")]
          public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);
          public const int LEFTDOWN = 0x02;
          public const int LEFTUP = 0x04;
          public const int RIGHTDOWN = 0x08;
          public const int RIGHTUP = 0x10;
          public static void LeftClick() { mouse_event(LEFTDOWN, 0, 0, 0, 0); mouse_event(LEFTUP, 0, 0, 0, 0); }
          public static void RightClick() { mouse_event(RIGHTDOWN, 0, 0, 0, 0); mouse_event(RIGHTUP, 0, 0, 0, 0); }
      }
"@
      Add-Type -TypeDefinition $code
    `;

    if (action === 'mouse_move') {
      psScript += `[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${params.x}, ${params.y})`;
    } else if (action === 'left_click') {
      psScript += `[OS]::LeftClick()`;
    } else if (action === 'right_click') {
      psScript += `[OS]::RightClick()`;
    } else if (action === 'type_text') {
      // Escape quotes for Powershell
      let text = params.text.replace(/'/g, "''");
      psScript += `[System.Windows.Forms.SendKeys]::SendWait('${text}')`;
    } else if (action === 'press_key') {
      psScript += `[System.Windows.Forms.SendKeys]::SendWait('${params.key}')`;
    }

    exec(`powershell -NoProfile -Command "${psScript}"`, (err) => {
      resolve(!err);
    });
  });
});

// 3. Action: Run Shell Command
ipcMain.handle('run-shell', async (event, command, cwd) => {
  const { exec } = require('child_process');
  return new Promise((resolve) => {
    exec(command, { cwd: cwd || process.cwd() }, (error, stdout, stderr) => {
      resolve({ stdout, stderr, error: error ? error.message : null });
    });
  });
});
// ────────────────────────────────────────────────────────────────────────────

// ─── WINDOW CONTROLS ────────────────────────────────────────────────────────
ipcMain.handle('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('close-window', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('open-preview-window', (event, url) => {
  const previewWin = new BrowserWindow({
    width: 1024,
    height: 768,
    title: "Imhotep OS - Detached Run Studio",
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  previewWin.setMenuBarVisibility(false);
  previewWin.loadURL(url);
  return true;
});

// ─── FILE WATCHER (CHOKIDAR) ──────────────────────────────────────────────────
ipcMain.handle('watch-folder', async (event, folderPath) => {
  if (currentWatcher) {
    await currentWatcher.close();
    currentWatcher = null;
  }

  if (!folderPath) return;

  currentWatcher = chokidar.watch(folderPath, {
    ignored: [
      /(^|[\/\\])\../, // ignore hidden files
      /node_modules/, // ignore node_modules
      /dist/,
      /\.git/
    ],
    persistent: true,
    ignoreInitial: true, // we already read the dir initially
  });

  const notifyChange = () => {
    if (mainWindow) {
      mainWindow.webContents.send('fs-change');
    }
  };

  currentWatcher
    .on('add', notifyChange)
    .on('unlink', notifyChange)
    .on('addDir', notifyChange)
    .on('unlinkDir', notifyChange);
    
  return { success: true };
});

// ─── CHAT HISTORY (PROJECT-BOUND) ───────────────────────────────────────────────
ipcMain.handle('load-chat-history', async (event, folderPath) => {
  try {
    const imhotepDir = path.join(folderPath, '.imhotep');
    const chatFile = path.join(imhotepDir, 'chat.json');
    if (fs.existsSync(chatFile)) {
      const data = fs.readFileSync(chatFile, 'utf8');
      return JSON.parse(data);
    }
    return null;
  } catch (e) {
    console.error("Failed to load chat history:", e);
    return null;
  }
});

ipcMain.handle('save-chat-history', async (event, folderPath, messages) => {
  try {
    const imhotepDir = path.join(folderPath, '.imhotep');
    if (!fs.existsSync(imhotepDir)) {
      fs.mkdirSync(imhotepDir, { recursive: true });
    }
    const chatFile = path.join(imhotepDir, 'chat.json');
    fs.writeFileSync(chatFile, JSON.stringify(messages, null, 2), 'utf8');
    return { success: true };
  } catch (e) {
    console.error("Failed to save chat history:", e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('search-files', async (event, folderPath, query) => {
  if (!folderPath || !query) return [];
  return searchInDir(folderPath, query);
});

ipcMain.handle('replace-in-files', async (event, replacements) => {
  // replacements: Array of { path, search, replace }
  let replacedCount = 0;
  for (const rep of replacements) {
    try {
      const fs = require('fs');
      let content = await fs.promises.readFile(rep.path, 'utf-8');
      // Escape search string for regex if we want global replace
      const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapeRegExp(rep.search), 'g');
      
      const newContent = content.replace(regex, rep.replace);
      if (newContent !== content) {
        await fs.promises.writeFile(rep.path, newContent, 'utf-8');
        replacedCount++;
      }
    } catch (e) {
      console.error(`Failed to replace in ${rep.path}`, e);
    }
  }
  return replacedCount;
});

ipcMain.handle('git-status', async (event, folderPath) => {
  if (!folderPath) return { isRepo: false, files: [], branch: '' };
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: folderPath });
    const statusOutput = execSync('git status --porcelain', { cwd: folderPath, encoding: 'utf-8' });
    const branchOutput = execSync('git rev-parse --abbrev-ref HEAD', { cwd: folderPath, encoding: 'utf-8' }).trim();
    const files = statusOutput.split('\n').filter(Boolean).map(line => {
      const status = line.slice(0, 2).trim();
      const file = line.slice(3).trim();
      return { file, status };
    });
    return { isRepo: true, files, branch: branchOutput };
  } catch (e) {
    return { isRepo: false, files: [], branch: '' };
  }
});

ipcMain.handle('git-commit', async (event, folderPath, commitMessage) => {
  if (!folderPath || !commitMessage) return false;
  try {
    await execAsync('git add .', { cwd: folderPath });
      const safeMsg = commitMessage.replace(/'/g, "'\\\x27\x27");
      await execAsync(`git commit -m '${safeMsg}'`, { cwd: folderPath });
    return true;
  } catch (e) {
    throw new Error(`Git commit failed: ${e.message}`);
  }
});

ipcMain.handle('git-init', async (event, folderPath) => {
  if (!folderPath) return false;
  try {
    execSync('git init', { cwd: folderPath });
    return true;
  } catch (e) {
    throw new Error(`Git init failed: ${e.message}`);
  }
});

// ─── NEW GIT OPERATIONS ────────────────────────────────────────────────────────

ipcMain.handle('git-push', async (event, folderPath) => {
  try {
    const { stdout, stderr } = await execAsync('git push 2>&1', { cwd: folderPath });
      const result = stdout + stderr;
    return { success: true, output: result };
  } catch (e) {
    throw new Error(e.stderr || e.message || 'Push failed');
  }
});

ipcMain.handle('git-pull', async (event, folderPath) => {
  try {
    const { stdout, stderr } = await execAsync('git pull 2>&1', { cwd: folderPath });
      const result = stdout + stderr;
    return { success: true, output: result };
  } catch (e) {
    throw new Error(e.stderr || e.message || 'Pull failed');
  }
});

ipcMain.handle('git-fetch', async (event, folderPath) => {
  try {
    const { stdout, stderr } = await execAsync('git fetch --all 2>&1', { cwd: folderPath });
      const result = stdout + stderr;
    return { success: true, output: result };
  } catch (e) {
    throw new Error(e.stderr || e.message || 'Fetch failed');
  }
});

ipcMain.handle('git-branches', async (event, folderPath) => {
  try {
    const local = execSync('git branch', { cwd: folderPath, encoding: 'utf-8' });
    const current = execSync('git rev-parse --abbrev-ref HEAD', { cwd: folderPath, encoding: 'utf-8' }).trim();
    const branches = local.split('\n')
      .map(b => b.replace('*', '').trim())
      .filter(Boolean);
    return { branches, current };
  } catch (e) {
    return { branches: [], current: '' };
  }
});

ipcMain.handle('git-checkout', async (event, folderPath, branchName) => {
  try {
    execSync(`git checkout "${branchName}"`, { cwd: folderPath });
    return { success: true };
  } catch (e) {
    throw new Error(e.message || 'Checkout failed');
  }
});

ipcMain.handle('git-create-branch', async (event, folderPath, branchName) => {
  try {
    execSync(`git checkout -b "${branchName}"`, { cwd: folderPath });
    return { success: true };
  } catch (e) {
    throw new Error(e.message || 'Create branch failed');
  }
});

ipcMain.handle('git-log', async (event, folderPath, limit = 30) => {
  try {
    const output = execSync(
      `git log --oneline --format="%H|%s|%an|%ar" -${limit}`,
      { cwd: folderPath, encoding: 'utf-8' }
    );
    return output.split('\n').filter(Boolean).map(line => {
      const [hash, subject, author, time] = line.split('|');
      return { hash: hash?.slice(0, 7), fullHash: hash, subject, author, time };
    });
  } catch (e) {
    return [];
  }
});

ipcMain.handle('git-blame', async (event, folderPath, filePath) => {
  try {
    const relative = path.relative(folderPath, filePath).replace(/\\/g, '/');
    const output = execSync(
      `git blame --line-porcelain "${relative}"`,
      { cwd: folderPath, encoding: 'utf-8' }
    );
    const lines = [];
    const chunks = output.split('\n');
    let current = {};
    for (const line of chunks) {
      if (line.match(/^[0-9a-f]{40}/)) {
        current = { hash: line.slice(0, 7) };
      } else if (line.startsWith('author ')) {
        current.author = line.slice(7);
      } else if (line.startsWith('author-time ')) {
        current.time = new Date(parseInt(line.slice(12)) * 1000).toLocaleDateString();
      } else if (line.startsWith('summary ')) {
        current.summary = line.slice(8);
      } else if (line.startsWith('\t')) {
        lines.push({ ...current, content: line.slice(1) });
        current = {};
      }
    }
    return lines;
  } catch (e) {
    return [];
  }
});

ipcMain.handle('git-diff', async (event, folderPath, filePath) => {
  try {
    const relative = filePath ? path.relative(folderPath, filePath).replace(/\\/g, '/') : '';
    const args = relative ? `"${relative}"` : '';
    const output = execSync(`git diff HEAD ${args}`, { cwd: folderPath, encoding: 'utf-8' });
    return { diff: output };
  } catch (e) {
    return { diff: '' };
  }
});

ipcMain.handle('reveal-in-explorer', async (event, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('open-in-terminal', async (event, folderPath) => {
  const { spawn } = require('child_process');
  if (process.platform === 'win32') {
    spawn('cmd.exe', ['/c', 'start', 'powershell.exe'], { cwd: folderPath, detached: true, shell: true });
  } else if (process.platform === 'darwin') {
    spawn('open', ['-a', 'Terminal', folderPath], { detached: true });
  } else {
    spawn('x-terminal-emulator', [], { cwd: folderPath, detached: true });
  }
  return true;
});


// --- PLUGINS API ---
const PLUGINS_DIR = path.join(app.getPath('userData'), 'plugins');

ipcMain.handle('plugin-save', async (event, pluginName, code) => {
  try {
    if (!fs.existsSync(PLUGINS_DIR)) {
      fs.mkdirSync(PLUGINS_DIR, { recursive: true });
    }
    const filePath = path.join(PLUGINS_DIR, `${pluginName}.js`);
    fs.writeFileSync(filePath, code, 'utf-8');
    return true;
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('plugin-load-all', async () => {
  try {
    if (!fs.existsSync(PLUGINS_DIR)) {
      fs.mkdirSync(PLUGINS_DIR, { recursive: true });
      return [];
    }
    const files = fs.readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.js'));
    return files.map(file => {
      const code = fs.readFileSync(path.join(PLUGINS_DIR, file), 'utf-8');
      return { name: file.replace('.js', ''), code };
    });
  } catch (error) {
    console.error("Failed to load plugins:", error);
    return [];
  }
});

ipcMain.handle('plugin-delete', async (event, pluginName) => {
  try {
    const filePath = path.join(PLUGINS_DIR, `${pluginName}.js`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  } catch (error) {
    throw new Error(error.message);
  }
});

let oauthServer = null;


ipcMain.handle('start-local-servers', async () => {
  const { spawn } = require('child_process');
  try {
    if (process.platform === 'win32') {
      // Try to start Ollama in the background if it's installed
      const ollama = spawn('ollama', ['serve'], { detached: true, stdio: 'ignore', windowsHide: true });
      ollama.unref();
      // Try to start LM Studio (usually installed at a specific path, but we can try generic or standard paths)
      const lmstudioPath = process.env.LOCALAPPDATA + '\\LM-Studio\\LM Studio.exe';
      if (fs.existsSync(lmstudioPath)) {
         const lms = spawn(lmstudioPath, [], { detached: true, stdio: 'ignore' });
         lms.unref();
      }
    }
    return true;
  } catch (e) {
    return false;
  }
});

ipcMain.handle('get-system-specs', async () => {
  const os = require('os');
  const totalRAM = os.totalmem();
  let gpuInfo = null;
  let freeDisk = 0;
  try {
    if (app.getGPUInfo) {
      gpuInfo = await app.getGPUInfo('complete');
    }
  } catch(e) {}
  try {
    const fs = require('fs');
    const stat = fs.statfsSync(app.getPath('userData'));
    freeDisk = stat.bfree * stat.bsize;
  } catch(e) {
    try {
      const fs = require('fs');
      const stat = fs.statfsSync('C:\\');
      freeDisk = stat.bfree * stat.bsize;
    } catch(e2) {}
  }
  return { totalRAM, platform: os.platform(), cpus: os.cpus(), gpuInfo, freeDisk };
});

ipcMain.handle('open-external', async (e, url) => { require('electron').shell.openExternal(url); });
  ipcMain.handle('google-login', async () => {
  if (oauthServer) {
    try { oauthServer.close(); } catch (e) {}
  }

  // Read Client ID from config or env
  let GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '711828284572-mhft02ifc91u0usk240aarmskfchnb9v.apps.googleusercontent.com';
  try {
    const configPath = path.join(process.cwd(), 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.googleClientId) GOOGLE_CLIENT_ID = config.googleClientId;
    }
  } catch (e) {
    // Ignore
  }
  
  return new Promise((resolve, reject) => {
    oauthServer = http.createServer(async (req, res) => {
      const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
      const pathname = parsedUrl.pathname;
      
      // If config is missing, show manual setup screen
      if (!GOOGLE_CLIENT_ID) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Configuration Required - Imhotep OS</title>
            <style>
                    ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.3); border-radius: 4px; }
      body {
        overflow-y: overlay;
        background: #0d0e12;
                color: #c8c8d4;
                font-family: sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
              }
              .box {
                padding: 40px;
                border-radius: 12px;
                background: #111218;
                border: 1px solid rgba(212,175,55,0.25);
                max-width: 480px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.5);
              }
              a { color: #D4AF37; text-decoration: none; }
              a:hover { text-decoration: underline; }
              ol { text-align: left; line-height: 1.8; font-size: 13px; color: #9999b0; }
              pre { background: #0d0e12; padding: 10px; border-radius: 4px; color: #00E699; overflow-x: auto; }
            </style>
          </head>
          <body>
            <div class="box">
              <h2 style="color: #ef4444; margin-top:0;">Google OAuth Config Required</h2>
              <p style="font-size: 14px;">To show your actual browser-logged-in Google Accounts, Imhotep OS must be registered in your Google Cloud Console:</p>
              <ol>
                <li>Go to <a href="https://console.cloud.google.com" target="_blank">Google Cloud Console</a>.</li>
                <li>Create a project & configure OAuth Consent Screen.</li>
                <li>Create an <strong>OAuth Client ID</strong> (Application type: <strong>Web Application</strong>).</li>
                <li>Add <code>http://127.0.0.1:8440/callback</code> to Authorized Redirect URIs.</li>
                <li>Create a file named <code>config.json</code> in the project folder with:
                  <pre>{
  "googleClientId": "YOUR_CLIENT_ID.apps.googleusercontent.com"
}</pre>
                </li>
              </ol>
              <p style="font-size:12px; color:#5f6368;">(Or click a mock profile below to bypass development mode setup:)</p>
              <div style="display:flex; gap:10px; justify-content:center; margin-top:15px;">
                <button onclick="window.location.href='/token-received?access_token=mock&email=pharaoh@imhotep-os.local'" style="background:rgba(212,175,55,0.15); border:1px solid #D4AF37; color:#D4AF37; padding:8px 16px; border-radius:4px; cursor:pointer;">Pharaoh Sandbox</button>
                <button onclick="window.location.href='/token-received?access_token=mock&email=imhotep.developer@gmail.com'" style="background:rgba(212,175,55,0.15); border:1px solid #D4AF37; color:#D4AF37; padding:8px 16px; border-radius:4px; cursor:pointer;">Developer Sandbox</button>
              </div>
            </div>
          </body>
          </html>
        `);
        return;
      }
      
      if (pathname === '/callback') {
        // Exchange Hash parameters to Query parameters via Browser JS
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <body>
            <script>
              if (window.location.hash) {
                const hash = window.location.hash.substring(1);
                const params = new URLSearchParams(hash);
                const token = params.get('access_token');
                if (token) {
                  window.location.href = '/token-received?access_token=' + encodeURIComponent(token);
                }
              } else {
                document.body.innerHTML = '<h2>Access token not found in URI hash fragment.</h2>';
              }
            </script>
          </body>
          </html>
        `);
      } else if (pathname === '/token-received') {
        const token = parsedUrl.searchParams.get('access_token');
        const mockEmail = parsedUrl.searchParams.get('email');
        
        let email = mockEmail || "pharaoh@imhotep-os.local";
        let name = "Pharaoh";
        
        if (token && token !== "mock") {
          try {
            // Fetch real user info from Google APIs using the access token
            const infoRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`);
            if (infoRes.ok) {
              const data = await infoRes.json();
              email = data.email || email;
              name = data.name || name;
            }
          } catch (e) {
            console.error("Failed to fetch userinfo from Google:", e);
          }
        }
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <title>Authentication Successful</title>
            <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Outfit:wght@300;400;600&display=swap" rel="stylesheet">
            <style>
                    ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.3); border-radius: 4px; }
      body {
        overflow-y: overlay;
        background: #090a0d;
                color: #c8c8d4;
                font-family: 'Outfit', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                overflow: hidden;
                position: relative;
              }
              body::before {
                content: "";
                position: absolute;
                width: 600px;
                height: 600px;
                background: radial-gradient(circle, rgba(0,230,153,0.05) 0%, rgba(212,175,55,0.02) 40%, transparent 70%);
                border-radius: 50%;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                pointer-events: none;
              }
              .box {
                padding: 48px;
                border-radius: 16px;
                background: rgba(17, 18, 24, 0.7);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(212,175,55,0.15);
                max-width: 440px;
                text-align: center;
                box-shadow: 0 16px 48px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05);
                animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                position: relative;
              }
              .icon-container {
                width: 64px;
                height: 64px;
                border-radius: 50%;
                background: rgba(0, 230, 153, 0.1);
                border: 1px solid rgba(0, 230, 153, 0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 24px auto;
                box-shadow: 0 0 24px rgba(0, 230, 153, 0.2);
                animation: scaleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both;
              }
              .icon-container svg {
                width: 32px;
                height: 32px;
                color: #00E699;
                stroke-width: 2.5;
                animation: drawCheck 0.6s ease-out 0.6s both;
              }
              h1 {
                color: #D4AF37;
                margin: 0 0 8px 0;
                font-family: 'Cinzel', serif;
                font-size: 28px;
                letter-spacing: 0.1em;
                font-weight: 700;
                animation: fadeUp 0.6s ease-out 0.4s both;
              }
              .status {
                color: #00E699;
                font-weight: 600;
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.2em;
                margin: 0 0 24px 0;
                animation: fadeUp 0.6s ease-out 0.5s both;
              }
              .message {
                font-size: 14px;
                color: #9999b0;
                line-height: 1.7;
                margin: 0;
                font-weight: 300;
                animation: fadeUp 0.6s ease-out 0.6s both;
              }
              strong {
                color: #e8e8f0;
                font-weight: 600;
              }
              .countdown {
                margin-top: 32px;
                font-size: 10px;
                color: #6b6b80;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                animation: fadeUp 0.6s ease-out 0.7s both;
              }
              
              /* Animations */
              @keyframes slideUp {
                0% { opacity: 0; transform: translateY(30px); }
                100% { opacity: 1; transform: translateY(0); }
              }
              @keyframes scaleIn {
                0% { opacity: 0; transform: scale(0.8); }
                100% { opacity: 1; transform: scale(1); }
              }
              @keyframes fadeUp {
                0% { opacity: 0; transform: translateY(10px); }
                100% { opacity: 1; transform: translateY(0); }
              }
              @keyframes drawCheck {
                0% { stroke-dasharray: 50; stroke-dashoffset: 50; }
                100% { stroke-dasharray: 50; stroke-dashoffset: 0; }
              }
            </style>
          </head>
          <body>
            <div class="box">
              <div class="icon-container">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <h1>IMHOTEP OS</h1>
              <p class="status">Sovereign Authentication Complete</p>
              <p class="message">Identity verified successfully as <strong>${email}</strong>.<br>Secure handshake established.</p>
              <p class="countdown" id="timerText">Closing bridge in 4s...</p>
            </div>
            
            <script>
              // Auto-close countdown logic
              let timeLeft = 3;
              const timerEl = document.getElementById('timerText');
              
              const interval = setInterval(() => {
                if (timeLeft <= 0) {
                  clearInterval(interval);
                  timerEl.innerText = "Returning to kernel...";
                  window.close();
                } else {
                  timerEl.innerText = "Closing bridge in " + timeLeft + "s...";
                  timeLeft--;
                }
              }, 1000);
            </script>
          </body>
          </html>
        `);
        
        oauthServer.close();
        resolve({ email, name });
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    
    oauthServer.listen(8440, '127.0.0.1', () => {
      if (GOOGLE_CLIENT_ID) {
        // Redirect to official Google sign-in
        const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=http://127.0.0.1:8440/callback&response_type=token&scope=openid%20email%20profile`;
        shell.openExternal(googleAuthUrl);
      } else {
        // Show sandbox setup helper
        shell.openExternal('http://127.0.0.1:8440/auth-page');
      }
    });
  });
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});








