'use strict';

const { spawn } = require('child_process');
const fs = require('fs');

class OpenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OpenError';
  }
}

function detectOpener() {
  const platform = process.platform;
  if (platform === 'darwin') return { cmd: 'open', args: [] };
  if (platform === 'win32') return { cmd: 'cmd', args: ['/c', 'start', '""'] };
  return { cmd: 'xdg-open', args: [] };
}

function openInBrowser(absolutePath) {
  if (!absolutePath || !fs.existsSync(absolutePath)) {
    throw new OpenError(`Cannot open missing file: ${absolutePath}`);
  }
  const { cmd, args } = detectOpener();
  const child = spawn(cmd, [...args, absolutePath], {
    detached: true,
    stdio: 'ignore'
  });
  child.on('error', () => {});
  child.unref();
}

function clickableUrl(absolutePath) {
  const normalized = absolutePath.split('\\').join('/');
  const encoded = normalized
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  if (process.platform === 'win32') {
    return `file:///${encoded.replace(/^\//, '')}`;
  }
  return `file://${encoded}`;
}

module.exports = { OpenError, openInBrowser, clickableUrl };
