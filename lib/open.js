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

function pathToFileUrl(absPath, platform = process.platform) {
  if (platform === 'win32') {
    const forward = absPath.split('\\').join('/');
    if (forward.startsWith('//')) {
      const withoutLeading = forward.slice(2);
      const slashIdx = withoutLeading.indexOf('/');
      const host = slashIdx === -1 ? withoutLeading : withoutLeading.slice(0, slashIdx);
      const rest = slashIdx === -1 ? '' : withoutLeading.slice(slashIdx);
      const encodedRest = rest
        .split('/')
        .map((s) => encodeURIComponent(s))
        .join('/');
      return `file://${host}${encodedRest}`;
    }
    const encoded = forward
      .split('/')
      .map((s) => encodeURIComponent(s))
      .join('/');
    return `file:///${encoded}`.replace(/^file:\/\/\/([A-Za-z])%3A/, 'file:///$1:');
  }
  const encoded = absPath
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/');
  return `file://${encoded}`;
}

function clickableUrl(absolutePath) {
  return pathToFileUrl(absolutePath);
}

module.exports = { OpenError, openInBrowser, clickableUrl, pathToFileUrl };
