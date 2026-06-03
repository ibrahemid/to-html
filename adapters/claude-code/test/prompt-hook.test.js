'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HOOK = path.join(__dirname, '..', 'bin', 'prompt-hook.js');
const CLI = path.join(__dirname, '..', 'bin', 'cli.js');

function freshCache() { return fs.mkdtempSync(path.join(os.tmpdir(), 'cc-ph-cache-')); }
function freshCwd() { return fs.mkdtempSync(path.join(os.tmpdir(), 'cc-ph-cwd-')); }

function runHook(cwd, env = {}) {
  return execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ cwd }),
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
}

function hookLogPath(cacheRoot) {
  return path.join(cacheRoot, 'cc-to-html', 'diag', 'hook.log');
}

function readPromptEvents(cacheRoot) {
  const p = hookLogPath(cacheRoot);
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((e) => e && e.kind === 'prompt');
}

test('prompt-hook injects no additionalContext when mode is off', () => {
  const cwd = freshCwd();
  const cache = freshCache();
  const out = runHook(cwd, { XDG_CACHE_HOME: cache });
  assert.equal(out.trim(), '', 'mode off must emit nothing');
  assert.equal(readPromptEvents(cache).length, 1, 'diag entry recorded');
});

test('prompt-hook injects no additionalContext when mode is on', () => {
  const cwd = freshCwd();
  const cache = freshCache();
  execFileSync(process.execPath, [CLI, 'toggle'], {
    env: { ...process.env, XDG_CACHE_HOME: cache, CLAUDE_PROJECT_DIR: cwd },
    encoding: 'utf8'
  });
  const out = runHook(cwd, { XDG_CACHE_HOME: cache, CLAUDE_PROJECT_DIR: cwd });
  assert.ok(!out.includes('additionalContext'), 'must never emit additionalContext');
  assert.ok(!/TL;?DR/i.test(out), 'must not mention TL;DR');
  assert.ok(!/mermaid/i.test(out), 'must not mention mermaid');
  assert.equal(out.trim(), '', 'mode on must emit nothing');
});

test('prompt-hook no-ops under the reentrancy sentinel', () => {
  const cwd = freshCwd();
  const cache = freshCache();
  const out = runHook(cwd, { XDG_CACHE_HOME: cache, TO_HTML_ENRICHING: '1' });
  assert.equal(out.trim(), '', 'sentinel must suppress all output');
  assert.equal(readPromptEvents(cache).length, 0, 'sentinel guard must suppress diag entry');
});
