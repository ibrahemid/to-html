#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { readState } = require('../lib/state');
const { resolveCacheRoot, sessionsDir, artifactsDir, homeShortcut } = require('../lib/paths');
const { readRecent, logFile } = require('../lib/diag');

function pad(label, value) {
  return label.padEnd(22, ' ') + (value == null ? '' : String(value));
}

function readPluginManifest() {
  try {
    const file = path.join(__dirname, '..', '.claude-plugin', 'plugin.json');
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return { name: 'to-html', version: '?', error: err.message };
  }
}

function formatEvent(e) {
  const parts = [e.t || '?', e.kind || '?'];
  if (e.mode) parts.push(`mode=${e.mode}`);
  if (e.template) parts.push(`tpl=${e.template}`);
  if (e.skipped != null) parts.push(`skipped=${e.skipped}`);
  if (e.cwd) parts.push(`cwd=${e.cwd}`);
  if (e.error) parts.push(`ERR=${e.error}`);
  if (e.tool) parts.push(`tool=${e.tool}`);
  return parts.join('  ');
}

function main() {
  const manifest = readPluginManifest();
  const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const state = readState(cwd);

  console.log('- to-html diagnostics -');
  console.log(pad('plugin version', manifest.version));
  console.log(pad('plugin path', __dirname));
  console.log(pad('node', process.version));
  console.log(pad('platform', `${os.platform()} ${os.release()}`));
  console.log('');
  console.log('- state -');
  console.log(pad('project cwd', state.cwd));
  console.log(pad('mode', state.mode));
  console.log(pad('autoOpen', String(state.autoOpen)));
  console.log(pad('active plan', state.activePlan ? state.activePlan.title : '(none)'));
  console.log(pad('state file', homeShortcut(state.__file)));
  console.log(pad('cache root', homeShortcut(resolveCacheRoot())));
  console.log(pad('sessions dir', homeShortcut(sessionsDir())));
  console.log(pad('artifacts dir', homeShortcut(artifactsDir())));
  console.log('');

  const events = readRecent(20);
  console.log(`- recent hook events (${events.length}) -`);
  if (events.length === 0) {
    console.log('(none yet)');
    console.log('');
    console.log('No hook events recorded. Either no assistant reply has happened since plugin install,');
    console.log('or CC has not re-registered the Stop / PostToolUse hooks. Try:');
    console.log('  1) /reload-plugins');
    console.log('  2) restart Claude Code if /reload-plugins did not help');
    console.log('  3) ask any question, then re-run `node ' + path.basename(__filename) + '`');
  } else {
    for (const e of events) console.log('  ' + formatEvent(e));
  }
  console.log('');
  console.log(pad('hook log', homeShortcut(logFile())));
}

main();
