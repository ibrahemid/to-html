'use strict';

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { sessionsDir } = require('./paths');
const { writeFileAtomic } = require('./io');

class StateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StateError';
  }
}

const SCHEMA_VERSION = 6;

const DEFAULT_ENRICH = 'on';
const DEFAULT_ENRICH_MODEL = 'claude-haiku-4-5-20251001';
const VALID_ENRICH_VALUES = new Set(['on', 'off']);

const DEFAULT_UI = Object.freeze({
  theme: 'auto',
  size: 'm',
  width: 'comfortable',
  family: 'sans'
});

const DEFAULT_RENDER_THRESHOLD = Object.freeze({
  minChars: 600,
  minHeadings: 2,
  minTableRows: 3,
  minCheckboxes: 3,
  manualToggleWindowMs: 8000
});

const VALID_UI_VALUES = Object.freeze({
  theme: new Set(['auto', 'light', 'dark', 'sepia']),
  size: new Set(['s', 'm', 'l', 'xl']),
  width: new Set(['narrow', 'comfortable', 'wide']),
  family: new Set(['sans', 'serif'])
});

const DEFAULT_STATE = Object.freeze({
  mode: 'off',
  autoOpen: false,
  uiDefaults: DEFAULT_UI,
  renderThreshold: DEFAULT_RENDER_THRESHOLD,
  enrich: DEFAULT_ENRICH,
  enrichModel: DEFAULT_ENRICH_MODEL,
  opener: null,
  cwd: null,
  activePlan: null,
  lastRenderedTextHash: null,
  createdAt: null,
  updatedAt: null,
  modeChangedAt: null,
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

function mergeUiDefaults(input) {
  const out = { ...DEFAULT_UI };
  if (input && typeof input === 'object') {
    for (const k of Object.keys(DEFAULT_UI)) {
      const v = input[k];
      if (typeof v === 'string' && VALID_UI_VALUES[k].has(v)) out[k] = v;
    }
  }
  return out;
}

function applyUiPatch(current, patch) {
  const out = mergeUiDefaults(current);
  if (!patch || typeof patch !== 'object') return out;
  for (const k of Object.keys(DEFAULT_UI)) {
    const v = patch[k];
    if (typeof v === 'string' && VALID_UI_VALUES[k].has(v)) out[k] = v;
  }
  return out;
}

function mergeRenderThreshold(input) {
  const out = { ...DEFAULT_RENDER_THRESHOLD };
  if (input && typeof input === 'object') {
    for (const k of Object.keys(DEFAULT_RENDER_THRESHOLD)) {
      const v = input[k];
      if (Number.isFinite(v) && v >= 0) out[k] = Math.floor(v);
    }
  }
  return out;
}

function applyRenderThresholdPatch(current, patch) {
  const out = mergeRenderThreshold(current);
  if (!patch || typeof patch !== 'object') return out;
  for (const k of Object.keys(DEFAULT_RENDER_THRESHOLD)) {
    const v = patch[k];
    if (Number.isFinite(v) && v >= 0) out[k] = Math.floor(v);
  }
  return out;
}

function migrate(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const incomingVersion = Number.isFinite(parsed.schemaVersion) ? parsed.schemaVersion : 0;
  if (incomingVersion >= SCHEMA_VERSION) return parsed;
  const migrated = { ...parsed, schemaVersion: SCHEMA_VERSION };
  if (incomingVersion < 3) {
    migrated.activePlan = null;
  }
  if (incomingVersion < 4) {
    migrated.uiDefaults = mergeUiDefaults(migrated.uiDefaults);
    migrated.renderThreshold = mergeRenderThreshold(migrated.renderThreshold);
    if (migrated.autoOpen == null) migrated.autoOpen = false;
  }
  if (incomingVersion < 5) {
    if (typeof migrated.enrich !== 'string' || !VALID_ENRICH_VALUES.has(migrated.enrich)) {
      migrated.enrich = DEFAULT_ENRICH;
    }
    if (typeof migrated.enrichModel !== 'string' || migrated.enrichModel.trim() === '') {
      migrated.enrichModel = DEFAULT_ENRICH_MODEL;
    }
  }
  if (incomingVersion < 6) {
    if (typeof migrated.opener !== 'string' || migrated.opener.trim() === '') migrated.opener = null;
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

function coerceEnrich(value) {
  return value === 'off' ? 'off' : DEFAULT_ENRICH;
}

function coerceEnrichModel(value) {
  if (typeof value !== 'string') return DEFAULT_ENRICH_MODEL;
  const trimmed = value.trim();
  return trimmed === '' ? DEFAULT_ENRICH_MODEL : trimmed;
}

function coerceOpener(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function normalize(state) {
  return {
    ...state,
    autoOpen: state.autoOpen === true,
    uiDefaults: mergeUiDefaults(state.uiDefaults),
    renderThreshold: mergeRenderThreshold(state.renderThreshold),
    enrich: coerceEnrich(state.enrich),
    enrichModel: coerceEnrichModel(state.enrichModel),
    opener: coerceOpener(state.opener)
  };
}

function readState(explicitCwd) {
  const { cwd, key } = resolveProjectKey(explicitCwd);
  const file = stateFileFor(key);
  if (!fs.existsSync(file)) {
    return normalize({ ...DEFAULT_STATE, cwd, __key: key, __file: file });
  }
  let raw = '';
  try {
    raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    const migrated = migrate(parsed) || {};
    return normalize({ ...DEFAULT_STATE, ...migrated, cwd, __key: key, __file: file });
  } catch (_err) {
    quarantineBadFile(file, raw);
    return normalize({ ...DEFAULT_STATE, cwd, __key: key, __file: file });
  }
}

function writeState(explicitCwd, patch) {
  const current = readState(explicitCwd);
  const now = new Date().toISOString();
  const modeChanged = patch && typeof patch.mode === 'string' && patch.mode !== current.mode;
  const merged = normalize({
    ...current,
    ...patch,
    uiDefaults: applyUiPatch(current.uiDefaults, patch && patch.uiDefaults),
    renderThreshold: applyRenderThresholdPatch(current.renderThreshold, patch && patch.renderThreshold),
    cwd: current.cwd,
    createdAt: current.createdAt || now,
    updatedAt: now,
    modeChangedAt: modeChanged ? now : current.modeChangedAt,
    schemaVersion: SCHEMA_VERSION
  });
  const { __key, __file, ...persisted } = merged;
  writeFileAtomic(current.__file, JSON.stringify(persisted, null, 2));
  return merged;
}

module.exports = {
  StateError,
  DEFAULT_STATE,
  DEFAULT_UI,
  DEFAULT_RENDER_THRESHOLD,
  DEFAULT_ENRICH,
  DEFAULT_ENRICH_MODEL,
  VALID_UI_VALUES,
  VALID_ENRICH_VALUES,
  SCHEMA_VERSION,
  resolveProjectKey,
  readState,
  writeState,
};
