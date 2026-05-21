'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');

const APP = 'cc-to-html';

class PathResolutionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PathResolutionError';
  }
}

function resolveCacheRoot() {
  const platform = process.platform;
  const home = os.homedir();
  if (!home) {
    throw new PathResolutionError('Could not resolve user home directory');
  }
  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Caches', APP);
  }
  if (platform === 'win32') {
    const local = process.env.LOCALAPPDATA;
    if (local) return path.join(local, APP, 'Cache');
    return path.join(home, 'AppData', 'Local', APP, 'Cache');
  }
  const xdg = process.env.XDG_CACHE_HOME;
  if (xdg) return path.join(xdg, APP);
  return path.join(home, '.cache', APP);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function sessionsDir() {
  return ensureDir(path.join(resolveCacheRoot(), 'sessions'));
}

function artifactsDir() {
  return ensureDir(path.join(resolveCacheRoot(), 'artifacts'));
}

function sessionStateFile(sessionId) {
  return path.join(sessionsDir(), `${sessionId}.json`);
}

function sessionArtifactsDir(sessionId) {
  return ensureDir(path.join(artifactsDir(), sessionId));
}

function homeShortcut(absolute) {
  const home = os.homedir();
  if (home && absolute.startsWith(home)) {
    return `~${absolute.slice(home.length)}`;
  }
  return absolute;
}

module.exports = {
  APP,
  PathResolutionError,
  resolveCacheRoot,
  sessionsDir,
  artifactsDir,
  sessionStateFile,
  sessionArtifactsDir,
  homeShortcut
};
