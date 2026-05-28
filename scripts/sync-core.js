#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

class SyncCoreError extends Error {
  constructor(message) { super(message); this.name = 'SyncCoreError'; }
}

function mirrorDir(src, dest) {
  if (!fs.existsSync(src)) throw new SyncCoreError(`source missing: ${src}`);
  fs.mkdirSync(dest, { recursive: true });
  const wantedEntries = new Map();
  (function walk(s, d) {
    for (const e of fs.readdirSync(s, { withFileTypes: true })) {
      const sp = path.join(s, e.name);
      const dp = path.join(d, e.name);
      if (e.isDirectory()) {
        fs.mkdirSync(dp, { recursive: true });
        walk(sp, dp);
      } else if (e.isFile()) {
        fs.copyFileSync(sp, dp);
        wantedEntries.set(path.relative(dest, dp), true);
      }
    }
  })(src, dest);

  (function prune(d) {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        prune(p);
        try { fs.rmdirSync(p); } catch (_) { }
      } else if (e.isFile()) {
        const rel = path.relative(dest, p);
        if (!wantedEntries.has(rel)) fs.unlinkSync(p);
      }
    }
  })(dest);
}

function syncCore({ root, adapter }) {
  if (!root || !adapter) throw new SyncCoreError('syncCore requires { root, adapter }');
  const coreSrc = path.join(root, 'core');
  const sharedSrc = path.join(root, 'shared');
  const adapterRoot = path.join(root, adapter);

  for (const sub of ['lib', 'vendor', 'assets']) {
    const s = path.join(coreSrc, sub);
    if (!fs.existsSync(s)) continue;
    mirrorDir(s, path.join(adapterRoot, 'core', sub));
  }
  if (fs.existsSync(sharedSrc)) {
    mirrorDir(sharedSrc, path.join(adapterRoot, 'shared'));
  }
}

if (require.main === module) {
  const root = process.cwd();
  syncCore({ root, adapter: 'adapters/claude-code' });
}

module.exports = { syncCore, mirrorDir, SyncCoreError };
