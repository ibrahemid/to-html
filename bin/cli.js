#!/usr/bin/env node
'use strict';

const { readState, writeState } = require('../lib/state');
const { homeShortcut, resolveCacheRoot } = require('../lib/paths');

const KNOWN_TOGGLE_ARGS = new Set(['on', 'off', 'status', 'reset', 'toggle']);
const KNOWN_AUTO_OPEN_ARGS = new Set(['yes', 'no', 'true', 'false']);

function parseArg(value, allowed) {
  if (value === undefined || value === null) return null;
  const v = String(value).trim().toLowerCase();
  if (v === '' || v.length > 16) return null;
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
  const ao = state.autoOpen === null ? 'unset' : (state.autoOpen ? 'yes' : 'no');
  return `HTML mode: ON · auto-open: ${ao} · artifacts → ${homeShortcut(resolveCacheRoot())}`;
}

function snapshot(state, changed) {
  return {
    ok: true,
    mode: state.mode,
    autoOpen: state.autoOpen,
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
    const next = writeState(null, { mode: 'off', autoOpen: null });
    return emit(snapshot(next, true));
  }
  if (arg === 'status') {
    return emit(snapshot(current, false));
  }
  const changed = target !== current.mode;
  const next = writeState(null, { mode: target });
  return emit(snapshot(next, changed));
}

function actionSetAutoOpen(arg) {
  if (!['yes', 'no', 'true', 'false'].includes(arg)) {
    fail(`set-auto-open expects "yes" or "no", got "${arg}"`);
  }
  const wantOpen = arg === 'yes' || arg === 'true';
  const next = writeState(null, { autoOpen: wantOpen });
  emit(snapshot(next, true));
}

function actionStatus() {
  const current = readState();
  emit(snapshot(current, false));
}

function main() {
  const [, , cmd = 'status', rawArg = ''] = process.argv;
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
    if (cmd === 'status') return actionStatus();
    fail(`Unknown cli command: ${cmd}`);
  } catch (err) {
    fail(`${err.name || 'Error'}: ${err.message}`);
  }
}

main();
