'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

process.env.XDG_CACHE_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-to-html-prompt-'));

const { writeState } = require('../lib/state');
const { CONTRACT_REMINDER } = require('../bin/prompt-hook');

const TEST_CWD = '/tmp/cc-to-html-prompt-tests';
const HOOK = path.join(__dirname, '..', 'bin', 'prompt-hook.js');

function runHook(payload, env) {
  return spawnSync('node', [HOOK], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: env
  });
}

test('prompt-hook: emits contract reminder when mode is on', () => {
  writeState(TEST_CWD, { mode: 'on' });
  const env = { ...process.env };
  const r = runHook({ cwd: TEST_CWD, prompt: 'hello' }, env);
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.equal(out.hookSpecificOutput.additionalContext, CONTRACT_REMINDER);
});

test('prompt-hook: emits nothing when mode is off', () => {
  writeState(TEST_CWD, { mode: 'off' });
  const env = { ...process.env };
  const r = runHook({ cwd: TEST_CWD, prompt: 'hello' }, env);
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), '');
});
