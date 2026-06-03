'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HOOK = path.join(__dirname, '..', 'bin', 'prompt-hook.js');

function runHook(cwd, env = {}) {
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ cwd }),
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
  return out;
}

test('prompt-hook injects no additionalContext when mode is off', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-ph-off-'));
  const out = runHook(cwd);
  assert.equal(out.trim(), '', 'mode off must emit nothing');
});

test('prompt-hook injects no additionalContext when mode is on', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-ph-on-'));
  process.env.XDG_CACHE_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-ph-cache-'));
  execFileSync(process.execPath, [path.join(__dirname, '..', 'bin', 'cli.js'), 'toggle'], {
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd }, encoding: 'utf8'
  });
  const out = runHook(cwd, { CLAUDE_PROJECT_DIR: cwd });
  assert.ok(!out.includes('additionalContext'), 'must never emit additionalContext');
  assert.ok(!/TL;?DR/i.test(out), 'must not mention TL;DR');
  assert.ok(!/mermaid/i.test(out), 'must not mention mermaid');
});

test('prompt-hook no-ops under the reentrancy sentinel', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-ph-sentinel-'));
  const out = runHook(cwd, { TO_HTML_ENRICHING: '1' });
  assert.equal(out.trim(), '', 'sentinel must suppress all output');
});
