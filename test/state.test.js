'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

process.env.XDG_CACHE_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-to-html-test-'));

const { readState, writeState, SCHEMA_VERSION } = require('../lib/state');
const { sessionsDir } = require('../lib/paths');

const TEST_CWD = '/tmp/cc-to-html-state-tests';

function clearState() {
  const dir = sessionsDir();
  for (const f of fs.readdirSync(dir)) {
    try { fs.unlinkSync(path.join(dir, f)); } catch (_) {}
  }
}

test('readState returns defaults when no file exists', () => {
  clearState();
  const s = readState(TEST_CWD);
  assert.equal(s.mode, 'off');
  assert.equal(s.autoOpen, null);
  assert.equal(s.schemaVersion, SCHEMA_VERSION);
});

test('writeState then readState round-trips', () => {
  clearState();
  writeState(TEST_CWD, { mode: 'on', autoOpen: true });
  const s = readState(TEST_CWD);
  assert.equal(s.mode, 'on');
  assert.equal(s.autoOpen, true);
});

test('readState quarantines and recovers from corrupted JSON', () => {
  clearState();
  writeState(TEST_CWD, { mode: 'on' });
  const file = readState(TEST_CWD).__file;
  fs.writeFileSync(file, '{not json', 'utf8');
  const recovered = readState(TEST_CWD);
  assert.equal(recovered.mode, 'off');
  const dir = path.dirname(file);
  const backups = fs.readdirSync(dir).filter((f) => f.includes('.bad.'));
  assert.ok(backups.length >= 1);
});

test('schema migration: old state without activePlan field is upgraded', () => {
  clearState();
  const file = readState(TEST_CWD).__file;
  fs.writeFileSync(file, JSON.stringify({
    mode: 'on',
    autoOpen: true,
    schemaVersion: 2,
    activePlan: { broken: 'old shape' }
  }), 'utf8');
  const s = readState(TEST_CWD);
  assert.equal(s.schemaVersion, SCHEMA_VERSION);
  assert.equal(s.activePlan, null);
  assert.equal(s.mode, 'on');
});

test('atomic write leaves no .tmp file on success', () => {
  clearState();
  writeState(TEST_CWD, { mode: 'on' });
  const dir = sessionsDir();
  const tmps = fs.readdirSync(dir).filter((f) => f.includes('.tmp-'));
  assert.equal(tmps.length, 0);
});
