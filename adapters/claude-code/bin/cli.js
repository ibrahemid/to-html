#!/usr/bin/env node
'use strict';

const { readState, writeState, VALID_UI_VALUES } = require('../lib/state');
const { homeShortcut, resolveCacheRoot } = require('../lib/paths');

const KNOWN_TOGGLE_ARGS = new Set(['on', 'off', 'status', 'reset', 'toggle']);
const KNOWN_AUTO_OPEN_ARGS = new Set(['yes', 'no', 'true', 'false', 'on', 'off']);
const CONFIG_KEYS = new Set(['auto-open', 'theme', 'size', 'width', 'font', 'show', 'enrich', 'enrich-model', 'opener']);

function parseArg(value, allowed) {
  if (value === undefined || value === null) return null;
  const v = String(value).trim().toLowerCase();
  if (v === '' || v.length > 32) return null;
  if (allowed && !allowed.has(v)) return null;
  return v;
}

function emit(payload) {
  process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
}

function fail(message, code = 1) {
  emit({ ok: false, error: message });
  process.exit(code);
}

function statusLine(state) {
  if (state.mode !== 'on') return 'HTML mode: OFF';
  const ao = state.autoOpen ? 'yes' : 'no';
  return `HTML mode: ON · auto-open: ${ao} · artifacts → ${homeShortcut(resolveCacheRoot())}`;
}

function snapshot(state, changed) {
  return {
    ok: true,
    mode: state.mode,
    autoOpen: state.autoOpen,
    uiDefaults: state.uiDefaults,
    enrich: state.enrich,
    enrichModel: state.enrichModel,
    opener: state.opener,
    cwd: state.cwd,
    stateFile: state.__file,
    changed,
    message: statusLine(state)
  };
}

function actionToggle(arg) {
  const current = readState();
  let target;
  if (arg === 'on') target = 'on';
  else if (arg === 'off') target = 'off';
  else if (arg === 'status') target = current.mode;
  else if (arg === 'reset') target = 'off';
  else target = current.mode === 'on' ? 'off' : 'on';

  if (arg === 'reset') {
    const next = writeState(null, { mode: 'off', autoOpen: false });
    return emit(snapshot(next, true));
  }
  if (arg === 'status') {
    return emit(snapshot(current, false));
  }
  const changed = target !== current.mode;
  const next = writeState(null, { mode: target });
  return emit(snapshot(next, changed));
}

function coerceBool(arg) {
  return arg === 'yes' || arg === 'true' || arg === 'on';
}

function actionSetAutoOpen(arg) {
  if (!KNOWN_AUTO_OPEN_ARGS.has(arg)) {
    fail(`set-auto-open expects yes/no, got "${arg}"`);
  }
  const next = writeState(null, { autoOpen: coerceBool(arg) });
  emit(snapshot(next, true));
}

function actionConfig(key, value) {
  const k = parseArg(key, CONFIG_KEYS);
  if (k === null) {
    fail(`config key must be one of: ${[...CONFIG_KEYS].join(', ')}`);
  }
  if (k === 'show') {
    return emit(snapshot(readState(), false));
  }
  const v = parseArg(value);
  if (v === null) fail(`config ${k} requires a value`);

  if (k === 'auto-open') {
    if (!KNOWN_AUTO_OPEN_ARGS.has(v)) fail(`auto-open expects yes/no`);
    return emit(snapshot(writeState(null, { autoOpen: coerceBool(v) }), true));
  }

  if (k === 'enrich') {
    if (v !== 'on' && v !== 'off') fail('enrich expects on/off');
    return emit(snapshot(writeState(null, { enrich: v }), true));
  }

  if (k === 'enrich-model') {
    const raw = String(value == null ? '' : value).trim();
    if (raw === '') fail('enrich-model requires a model id');
    return emit(snapshot(writeState(null, { enrichModel: raw }), true));
  }

  if (k === 'opener') {
    const raw = String(value == null ? '' : value).trim();
    const opener = (raw === '' || raw.toLowerCase() === 'default' || raw.toLowerCase() === 'none') ? null : raw;
    return emit(snapshot(writeState(null, { opener }), true));
  }

  const uiKey = k === 'font' ? 'family' : k;
  if (!VALID_UI_VALUES[uiKey] || !VALID_UI_VALUES[uiKey].has(v)) {
    const allowed = VALID_UI_VALUES[uiKey] ? [...VALID_UI_VALUES[uiKey]].join('|') : '?';
    fail(`config ${k} expects one of: ${allowed}`);
  }
  const next = writeState(null, { uiDefaults: { [uiKey]: v } });
  emit(snapshot(next, true));
}

function actionStatus() {
  const current = readState();
  emit(snapshot(current, false));
}

function main() {
  const [, , cmd = 'status', rawArg = '', rawArg2 = ''] = process.argv;
  const trimmed = String(rawArg).trim();
  try {
    if (cmd === 'toggle') {
      if (trimmed === '') return actionToggle(null);
      const arg = parseArg(rawArg, KNOWN_TOGGLE_ARGS);
      if (arg === null) {
        return fail(`Unrecognized argument. Expected one of: ${[...KNOWN_TOGGLE_ARGS].join(', ')}`);
      }
      return actionToggle(arg);
    }
    if (cmd === 'set-auto-open') return actionSetAutoOpen(parseArg(rawArg, KNOWN_AUTO_OPEN_ARGS));
    if (cmd === 'config') return actionConfig(rawArg, rawArg2);
    if (cmd === 'status') return actionStatus();
    fail(`Unknown cli command: ${cmd}`);
  } catch (err) {
    fail(`${err.name || 'Error'}: ${err.message}`);
  }
}

main();
