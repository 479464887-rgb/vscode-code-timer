// Code Timer - VS Code Extension
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

let statusBarItem;
let timerInterval;
let startTime = null;
let totalSeconds = 0;
let idleTimer = null;
let lastActivity = Date.now();
let isActive = false;

function activate(context) {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'code-timer.showStats';
  context.subscriptions.push(statusBarItem);

  // Load saved stats
  loadStats();

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('code-timer.showStats', showStats)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('code-timer.resetStats', resetStats)
  );

  // Track activity
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(() => recordActivity())
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(() => recordActivity())
  );

  // Start
  startTimer();
  updateStatusBar();
  timerInterval = setInterval(() => {
    updateTimer();
    updateStatusBar();
    checkIdle();
  }, 1000);

  vscode.window.showInformationMessage('🕐 Code Timer started. Coding time being tracked.');
}

function recordActivity() {
  lastActivity = Date.now();
  if (!isActive) {
    isActive = true;
    if (!startTime) startTime = Date.now();
  }
}

function checkIdle() {
  const config = vscode.workspace.getConfiguration('code-timer');
  const timeout = (config.get('idleTimeout') || 300) * 1000;
  if (isActive && Date.now() - lastActivity > timeout) {
    isActive = false;
    if (startTime) {
      totalSeconds += Math.floor((Date.now() - startTime) / 1000);
      startTime = null;
      saveStats();
    }
  }
}

function updateTimer() {
  if (isActive && startTime) {
    totalSeconds += 1;
    startTime = Date.now();
    if (totalSeconds % 60 === 0) saveStats();
  }
}

function updateStatusBar() {
  const config = vscode.workspace.getConfiguration('code-timer');
  if (config.get('showInStatusBar') === false) {
    statusBarItem.hide();
    return;
  }
  const active = totalSeconds + (isActive && startTime ? Math.floor((Date.now() - startTime) / 1000) : 0);
  const h = Math.floor(active / 3600);
  const m = Math.floor((active % 3600) / 60);
  const s = active % 60;
  const icon = isActive ? '$(pulse)' : '$(history)';
  statusBarItem.text = `${icon} ${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  statusBarItem.tooltip = `Coding time today. Click for details.`;
  statusBarItem.show();
}

function getStatsPath() {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) return null;
  return path.join(workspace.uri.fsPath, '.vscode', 'code-timer.json');
}

function loadStats() {
  const statsPath = getStatsPath();
  if (!statsPath) return;
  try {
    if (fs.existsSync(statsPath)) {
      const data = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
      const today = new Date().toDateString();
      if (data.date === today) {
        totalSeconds = data.totalSeconds || 0;
      }
    }
  } catch (e) {
    // ignore
  }
}

function saveStats() {
  const statsPath = getStatsPath();
  if (!statsPath) return;
  try {
    const dir = path.dirname(statsPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(statsPath, JSON.stringify({
      date: new Date().toDateString(),
      totalSeconds,
      savedAt: new Date().toISOString()
    }, null, 2));
  } catch (e) {
    // ignore
  }
}

function showStats() {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  vscode.window.showInformationMessage(
    `🕐 Today: ${h}h ${m}m coded. Streak: keep going!`
  );
}

function resetStats() {
  vscode.window.showWarningMessage(
    'Reset today\'s coding stats?',
    { modal: true },
    'Reset'
  ).then(answer => {
    if (answer === 'Reset') {
      totalSeconds = 0;
      saveStats();
      updateStatusBar();
      vscode.window.showInformationMessage('Stats reset.');
    }
  });
}

function deactivate() {
  if (timerInterval) clearInterval(timerInterval);
  if (idleTimer) clearTimeout(idleTimer);
  saveStats();
}

module.exports = { activate, deactivate };
