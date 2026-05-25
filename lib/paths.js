'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const APP = 'cc-to-html';
const SAFE_SESSION_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

class PathResolutionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PathResolutionError';
  }
}

function resolveCacheRoot() {
  const xdg = process.env.XDG_CACHE_HOME;
  if (xdg) return path.join(xdg, APP);
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

function safeSessionSegment(rawSessionId) {
  const value = rawSessionId == null ? '' : String(rawSessionId);
  if (SAFE_SESSION_ID_RE.test(value)) return value;
  return 's-' + crypto.createHash('sha1').update(`session:${value}`).digest('hex').slice(0, 24);
}

function assertContained(parent, child) {
  const parentResolved = path.resolve(parent) + path.sep;
  const childResolved = path.resolve(child);
  if (!(childResolved === path.resolve(parent) || childResolved.startsWith(parentResolved))) {
    throw new PathResolutionError(`Refused to write outside cache root: ${childResolved}`);
  }
  return childResolved;
}

function sessionArtifactsDir(rawSessionId) {
  const seg = safeSessionSegment(rawSessionId);
  const root = artifactsDir();
  const dir = assertContained(root, path.join(root, seg));
  return ensureDir(dir);
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
  SAFE_SESSION_ID_RE,
  resolveCacheRoot,
  sessionsDir,
  artifactsDir,
  safeSessionSegment,
  assertContained,
  sessionArtifactsDir,
  homeShortcut
};
