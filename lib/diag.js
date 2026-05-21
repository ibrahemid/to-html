'use strict';

const fs = require('fs');
const path = require('path');
const { resolveCacheRoot } = require('./paths');

const MAX_LOG_LINES = 200;
const MAX_LOG_BYTES = 256 * 1024;

function diagDir() {
  const dir = path.join(resolveCacheRoot(), 'diag');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function logFile() {
  return path.join(diagDir(), 'hook.log');
}

function appendEvent(event) {
  const line = JSON.stringify({ t: new Date().toISOString(), ...event });
  const file = logFile();
  try {
    let existing = '';
    if (fs.existsSync(file)) {
      const stat = fs.statSync(file);
      if (stat.size > MAX_LOG_BYTES) {
        existing = fs.readFileSync(file, 'utf8').split('\n').slice(-MAX_LOG_LINES).join('\n');
        fs.writeFileSync(file, existing + '\n', 'utf8');
      }
    }
    fs.appendFileSync(file, line + '\n', 'utf8');
  } catch (_) { /* best-effort */ }
}

function readRecent(n = 25) {
  const file = logFile();
  if (!fs.existsSync(file)) return [];
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const lines = raw.split('\n').filter((l) => l.trim());
    return lines.slice(-n).map((l) => {
      try { return JSON.parse(l); } catch (_) { return { raw: l }; }
    });
  } catch (_) { return []; }
}

module.exports = { appendEvent, readRecent, logFile, diagDir };
