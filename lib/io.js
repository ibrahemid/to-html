'use strict';

const fs = require('fs');
const path = require('path');

const MAX_STDIN_BYTES = 4 * 1024 * 1024;
const STDIN_TIMEOUT_MS = 5000;

class IoError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'IoError';
    this.code = code || 'IO_ERROR';
  }
}

function readJsonStdin({ timeoutMs = STDIN_TIMEOUT_MS, maxBytes = MAX_STDIN_BYTES } = {}) {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve({});
    let data = '';
    let bytes = 0;
    let resolved = false;

    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => {
      process.stderr.write('[to-html] stdin read timed out, continuing with empty payload\n');
      finish({});
    }, timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      bytes += Buffer.byteLength(chunk, 'utf8');
      if (bytes > maxBytes) {
        process.stderr.write(`[to-html] stdin payload exceeded ${maxBytes} bytes, truncating\n`);
        process.stdin.removeAllListeners('data');
        finish(parseSafe(data));
        return;
      }
      data += chunk;
    });
    process.stdin.on('end', () => finish(parseSafe(data)));
    process.stdin.on('error', () => finish({}));
  });
}

function parseSafe(raw) {
  if (!raw || !raw.trim()) return {};
  try { return JSON.parse(raw); } catch (err) {
    process.stderr.write(`[to-html] stdin JSON parse failed: ${err.message}\n`);
    return {};
  }
}

function writeFileAtomic(file, contents) {
  const dir = path.dirname(file);
  const tmp = path.join(dir, `.${path.basename(file)}.tmp-${process.pid}-${Date.now()}`);
  fs.writeFileSync(tmp, contents, 'utf8');
  fs.renameSync(tmp, file);
}

module.exports = {
  IoError,
  MAX_STDIN_BYTES,
  STDIN_TIMEOUT_MS,
  readJsonStdin,
  parseSafe,
  writeFileAtomic
};
