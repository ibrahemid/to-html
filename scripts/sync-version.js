#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const TARGETS = [
  'adapters/claude-code/package.json',
  'adapters/claude-code/.claude-plugin/plugin.json',
  'core/package.json',
  'cli/package.json',
  'shared/transcript/package.json'
];

class SyncVersionError extends Error {
  constructor(message) { super(message); this.name = 'SyncVersionError'; }
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJsonStable(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}

function syncVersion({ root }) {
  if (!root) throw new SyncVersionError('syncVersion requires { root }');
  const rootPkg = readJson(path.join(root, 'package.json'));
  if (!rootPkg.version || typeof rootPkg.version !== 'string') {
    throw new SyncVersionError('root package.json has no `version` field');
  }
  const version = rootPkg.version;

  for (const rel of TARGETS) {
    const p = path.join(root, rel);
    if (!fs.existsSync(p)) continue;
    const obj = readJson(p);
    if (obj.version === version) continue;
    obj.version = version;
    writeJsonStable(p, obj);
  }
  return { version, written: TARGETS.filter((t) => fs.existsSync(path.join(root, t))) };
}

if (require.main === module) {
  const out = syncVersion({ root: process.cwd() });
  process.stdout.write(`sync-version: ${out.version} -> ${out.written.length} target(s)\n`);
}

module.exports = { syncVersion, TARGETS, SyncVersionError };
