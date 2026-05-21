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

const DEFAULT_STATE = Object.freeze({
  mode: 'off',
  autoOpen: null,
  cwd: null,
  activePlan: null,
  createdAt: null,
  updatedAt: null,
  schemaVersion: 3
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

function readState(explicitCwd) {
  const { cwd, key } = resolveProjectKey(explicitCwd);
  const file = stateFileFor(key);
  if (!fs.existsSync(file)) {
    return { ...DEFAULT_STATE, cwd, __key: key, __file: file };
  }
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed, cwd, __key: key, __file: file };
  } catch (err) {
    throw new StateError(`Corrupted state at ${file}: ${err.message}`);
  }
}

function writeState(explicitCwd, patch) {
  const current = readState(explicitCwd);
  const now = new Date().toISOString();
  const merged = {
    ...current,
    ...patch,
    cwd: current.cwd,
    createdAt: current.createdAt || now,
    updatedAt: now
  };
  const { __key, __file, ...persisted } = merged;
  fs.writeFileSync(current.__file, JSON.stringify(persisted, null, 2), 'utf8');
  return merged;
}

function isModeOn(explicitCwd) {
  return readState(explicitCwd).mode === 'on';
}

module.exports = {
  StateError,
  DEFAULT_STATE,
  resolveProjectKey,
  readState,
  writeState,
  isModeOn
};
