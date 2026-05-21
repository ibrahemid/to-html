'use strict';

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { sessionsDir } = require('./paths');

class StateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StateError';
  }
}

const SCHEMA_VERSION = 3;

const DEFAULT_STATE = Object.freeze({
  mode: 'off',
  autoOpen: null,
  cwd: null,
  activePlan: null,
  createdAt: null,
  updatedAt: null,
  schemaVersion: SCHEMA_VERSION
});

function resolveProjectKey(explicitCwd) {
  const cwd = explicitCwd
    || process.env.CLAUDE_PROJECT_DIR
    || process.cwd()
    || '';
  const canonical = cwd ? path.resolve(cwd) : 'unknown';
  return {
    cwd: canonical,
    key: crypto.createHash('sha1').update(`project:${canonical}`).digest('hex').slice(0, 16)
  };
}

function stateFileFor(key) {
  return path.join(sessionsDir(), `${key}.json`);
}

function migrate(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const incomingVersion = Number.isFinite(parsed.schemaVersion) ? parsed.schemaVersion : 0;
  if (incomingVersion >= SCHEMA_VERSION) return parsed;
  const migrated = { ...parsed, schemaVersion: SCHEMA_VERSION };
  if (incomingVersion < 3) {
    migrated.activePlan = null;
  }
  return migrated;
}

function quarantineBadFile(file, raw) {
  try {
    const backup = `${file}.bad.${Date.now()}`;
    fs.writeFileSync(backup, raw == null ? '' : String(raw), 'utf8');
    process.stderr.write(`[to-html] state file unreadable, quarantined → ${backup}\n`);
  } catch (_) {
    // best-effort
  }
}

function readState(explicitCwd) {
  const { cwd, key } = resolveProjectKey(explicitCwd);
  const file = stateFileFor(key);
  if (!fs.existsSync(file)) {
    return { ...DEFAULT_STATE, cwd, __key: key, __file: file };
  }
  let raw = '';
  try {
    raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    const migrated = migrate(parsed) || {};
    return { ...DEFAULT_STATE, ...migrated, cwd, __key: key, __file: file };
  } catch (err) {
    quarantineBadFile(file, raw);
    return { ...DEFAULT_STATE, cwd, __key: key, __file: file };
  }
}

function writeFileAtomic(file, contents) {
  const dir = path.dirname(file);
  const tmp = path.join(dir, `.${path.basename(file)}.tmp-${process.pid}-${Date.now()}`);
  fs.writeFileSync(tmp, contents, 'utf8');
  fs.renameSync(tmp, file);
}

function writeState(explicitCwd, patch) {
  const current = readState(explicitCwd);
  const now = new Date().toISOString();
  const merged = {
    ...current,
    ...patch,
    cwd: current.cwd,
    createdAt: current.createdAt || now,
    updatedAt: now,
    schemaVersion: SCHEMA_VERSION
  };
  const { __key, __file, ...persisted } = merged;
  writeFileAtomic(current.__file, JSON.stringify(persisted, null, 2));
  return merged;
}

function isModeOn(explicitCwd) {
  return readState(explicitCwd).mode === 'on';
}

module.exports = {
  StateError,
  DEFAULT_STATE,
  SCHEMA_VERSION,
  resolveProjectKey,
  readState,
  writeState,
  writeFileAtomic,
  isModeOn
};
