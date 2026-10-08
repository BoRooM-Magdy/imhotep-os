const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Filesystem
  serveFolder: (folderPath) => ipcRenderer.invoke('serve-folder', folderPath),
  saveFileDialog: () => ipcRenderer.invoke('save-file-dialog'),
  newWindow: () => ipcRenderer.invoke('new-window'),
  toggleDevTools: () => ipcRenderer.invoke('toggle-devtools'),
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readDir: (folderPath) => ipcRenderer.invoke('read-dir', folderPath),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  createFile: (filePath) => ipcRenderer.invoke('create-file', filePath),
  createDir: (dirPath) => ipcRenderer.invoke('create-dir', dirPath),
  deletePath: (pathToRemove) => ipcRenderer.invoke('delete-path', pathToRemove),
  renamePath: (oldPath, newPath) => ipcRenderer.invoke('rename-path', oldPath, newPath),
  searchFiles: (folderPath, query) => ipcRenderer.invoke('search-files', folderPath, query),
  replaceInFiles: (replacements) => ipcRenderer.invoke('replace-in-files', replacements),

  // File Watcher
  watchFolder: (folderPath) => ipcRenderer.invoke('watch-folder', folderPath),
  onTriggerSimulator: (callback) => {
    ipcRenderer.on('trigger-simulator', callback);
    return () => ipcRenderer.removeAllListeners('trigger-simulator');
  },

  onFileSystemChange: (callback) => {
    ipcRenderer.on('fs-change', callback);
    return () => ipcRenderer.removeAllListeners('fs-change');
  },

  // TS Watcher
  startTsWatcher: (folderPath) => ipcRenderer.send('start-ts-watcher', folderPath),
  stopTsWatcher: () => ipcRenderer.send('stop-ts-watcher'),
  onTsProblems: (callback) => {
    ipcRenderer.on('ts-problems', (event, problems) => callback(problems));
    return () => ipcRenderer.removeAllListeners('ts-problems');
  },

  // Git  Core
  getGitStatus: (folderPath) => ipcRenderer.invoke('git-status', folderPath),
  gitCommit: (folderPath, commitMessage) => ipcRenderer.invoke('git-commit', folderPath, commitMessage),
  gitInit: (folderPath) => ipcRenderer.invoke('git-init', folderPath),

  // Git  Remote
  gitPush: (folderPath) => ipcRenderer.invoke('git-push', folderPath),
  gitPull: (folderPath) => ipcRenderer.invoke('git-pull', folderPath),
  gitFetch: (folderPath) => ipcRenderer.invoke('git-fetch', folderPath),

  // Git  Branches
  gitBranches: (folderPath) => ipcRenderer.invoke('git-branches', folderPath),
  gitCheckout: (folderPath, branchName) => ipcRenderer.invoke('git-checkout', folderPath, branchName),
  gitCreateBranch: (folderPath, branchName) => ipcRenderer.invoke('git-create-branch', folderPath, branchName),

  // Git  History & Diff
  gitLog: (folderPath, limit) => ipcRenderer.invoke('git-log', folderPath, limit),
  gitBlame: (folderPath, filePath) => ipcRenderer.invoke('git-blame', folderPath, filePath),
  gitDiff: (folderPath, filePath) => ipcRenderer.invoke('git-diff', folderPath, filePath),

  // Shell Operations
  revealInExplorer: (filePath) => ipcRenderer.invoke('reveal-in-explorer', filePath),
  openInTerminal: (folderPath) => ipcRenderer.invoke('open-in-terminal', folderPath),

  // Custom Plugins APIs
  pluginSave: (pluginName, code) => ipcRenderer.invoke('plugin-save', pluginName, code),
  pluginLoadAll: () => ipcRenderer.invoke('plugin-load-all'),
  pluginDelete: (pluginName) => ipcRenderer.invoke('plugin-delete', pluginName),

  // Chat History
  loadChatHistory: (folderPath) => ipcRenderer.invoke('load-chat-history', folderPath),
  saveChatHistory: (folderPath, messages) => ipcRenderer.invoke('save-chat-history', folderPath, messages),

  // Window Controls
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  openPreviewWindow: (url) => ipcRenderer.invoke('open-preview-window', url),

  // Auth
  getSystemSpecs: () => ipcRenderer.invoke('get-system-specs'),
  startLocalServers: () => ipcRenderer.invoke('start-local-servers'),
  takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
  osAction: (action, params) => ipcRenderer.invoke('os-action', action, params),
  runShell: (command, cwd) => ipcRenderer.invoke('run-shell', command, cwd),

  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  googleLogin: () => ipcRenderer.invoke('google-login'),

  // Terminal
  startTerminal: (folderPath) => ipcRenderer.send('start-terminal', folderPath),
  writeTerminal: (data) => ipcRenderer.send('write-terminal', data),
  resizeTerminal: (cols, rows) => ipcRenderer.send('resize-terminal', cols, rows),
  onTerminalData: (callback) => {
    ipcRenderer.removeAllListeners('terminal-data');
    const handler = (event, data) => callback(data);
    ipcRenderer.on('terminal-data', handler);
    return () => ipcRenderer.removeListener('terminal-data', handler);
  },
});

