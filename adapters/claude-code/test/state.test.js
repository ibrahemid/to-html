'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

process.env.XDG_CACHE_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-to-html-test-'));

const { readState, writeState, SCHEMA_VERSION, DEFAULT_UI, DEFAULT_RENDER_THRESHOLD } = require('../lib/state');
const { sessionsDir } = require('../lib/paths');

const TEST_CWD = '/tmp/cc-to-html-state-tests';

function clearState() {
  const dir = sessionsDir();
  for (const f of fs.readdirSync(dir)) {
    try { fs.unlinkSync(path.join(dir, f)); } catch (_) { } // intentional ignore
  }
}

test('readState returns defaults when no file exists', () => {
  clearState();
  const s = readState(TEST_CWD);
  assert.equal(s.mode, 'off');
  assert.equal(s.autoOpen, false);
  assert.equal(s.schemaVersion, SCHEMA_VERSION);
  assert.deepEqual(s.uiDefaults, DEFAULT_UI);
  assert.deepEqual(s.renderThreshold, DEFAULT_RENDER_THRESHOLD);
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

test('v3 → v4 migration fills uiDefaults, renderThreshold, autoOpen', () => {
  clearState();
  const file = readState(TEST_CWD).__file;
  fs.writeFileSync(file, JSON.stringify({
    mode: 'on',
    autoOpen: null,
    activePlan: null,
    schemaVersion: 3
  }), 'utf8');
  const s = readState(TEST_CWD);
  assert.equal(s.schemaVersion, SCHEMA_VERSION);
  assert.equal(s.autoOpen, false);
  assert.deepEqual(s.uiDefaults, DEFAULT_UI);
  assert.deepEqual(s.renderThreshold, DEFAULT_RENDER_THRESHOLD);
});

test('writeState updates modeChangedAt only on mode transition', async () => {
  clearState();
  const a = writeState(TEST_CWD, { mode: 'on' });
  const t1 = a.modeChangedAt;
  assert.ok(t1);
  await new Promise((r) => setTimeout(r, 10));
  const b = writeState(TEST_CWD, { lastRenderedTextHash: 'abc' });
  assert.equal(b.modeChangedAt, t1);
  await new Promise((r) => setTimeout(r, 10));
  const c = writeState(TEST_CWD, { mode: 'off' });
  assert.notEqual(c.modeChangedAt, t1);
});

test('uiDefaults merge accepts valid values and rejects invalid', () => {
  clearState();
  const s1 = writeState(TEST_CWD, { uiDefaults: { theme: 'dark', size: 'l' } });
  assert.equal(s1.uiDefaults.theme, 'dark');
  assert.equal(s1.uiDefaults.size, 'l');
  const s2 = writeState(TEST_CWD, { uiDefaults: { theme: 'rainbow', size: 'huge' } });
  assert.equal(s2.uiDefaults.theme, 'dark');
  assert.equal(s2.uiDefaults.size, 'l');
});

test('DEFAULT_STATE includes enrich on + a haiku-class enrichModel', () => {
  clearState();
  const s = readState(TEST_CWD);
  assert.equal(s.enrich, 'on');
  assert.equal(typeof s.enrichModel, 'string');
  assert.ok(s.enrichModel.length > 0);
});

test('schema migration: v4 state file gets enrich defaults on read (schemaVersion bumped to 5)', () => {
  clearState();
  const file = readState(TEST_CWD).__file;
  fs.writeFileSync(file, JSON.stringify({
    mode: 'on',
    autoOpen: true,
    activePlan: null,
    schemaVersion: 4
  }), 'utf8');
  const s = readState(TEST_CWD);
  assert.equal(s.enrich, 'on');
  assert.equal(typeof s.enrichModel, 'string');
  assert.ok(s.enrichModel.length > 0);
  assert.equal(s.schemaVersion, SCHEMA_VERSION);
  assert.equal(SCHEMA_VERSION, 5);
});

test('writeState round-trips enrich + enrichModel', () => {
  clearState();
  const s1 = writeState(TEST_CWD, { enrich: 'off' });
  assert.equal(s1.enrich, 'off');
  const s2 = writeState(TEST_CWD, { enrichModel: 'claude-haiku-4-5-20251001' });
  assert.equal(s2.enrichModel, 'claude-haiku-4-5-20251001');
});

test('enrich is coerced to on for invalid values; enrichModel falls back to default when empty', () => {
  clearState();
  const file = readState(TEST_CWD).__file;
  fs.writeFileSync(file, JSON.stringify({
    mode: 'off',
    schemaVersion: 5,
    enrich: 'maybe',
    enrichModel: '   '
  }), 'utf8');
  const s = readState(TEST_CWD);
  assert.equal(s.enrich, 'on');
  assert.ok(s.enrichModel.length > 0);
});
