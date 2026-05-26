'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const HOOK = path.join(__dirname, '../bin/post-tool-hook.js');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cc-to-html-posthook-'));
}

function runHook(input, tmp) {
  const raw = typeof input === 'string' ? input : JSON.stringify(input);
  return spawnSync('node', [HOOK], {
    input: raw,
    encoding: 'utf8',
    env: { ...process.env, XDG_CACHE_HOME: tmp }
  });
}

function writeStateFor(cwd, patch, tmp) {
  const origCache = process.env.XDG_CACHE_HOME;
  process.env.XDG_CACHE_HOME = tmp;
  const { writeState } = require('../lib/state');
  writeState(cwd, patch);
  process.env.XDG_CACHE_HOME = origCache;
}

const PLAN_MD = '## Phase 1: Setup\n\n- [ ] Init repo\n- [ ] Configure CI\n\n## Phase 2: Build\n\n- [x] Write code\n- [ ] Add tests';
const TEST_CWD = '/tmp/cc-to-html-posthook-tests';

test('post-tool-hook: always exits 0 on empty stdin', () => {
  const tmp = makeTmp();
  const r = runHook('', tmp);
  assert.equal(r.status, 0, 'must exit 0 on empty stdin');
  assert.equal(r.stdout.trim(), '', 'no output on empty stdin');
});

test('post-tool-hook: always exits 0 on garbage stdin', () => {
  const tmp = makeTmp();
  const r = runHook('not valid json at all!!!', tmp);
  assert.equal(r.status, 0, 'must exit 0 on garbage stdin');
});

test('post-tool-hook: exits 0 on non-ExitPlanMode tool', () => {
  const tmp = makeTmp();
  const payload = { tool_name: 'Bash', cwd: TEST_CWD, session_id: 'test', tool_input: { command: 'ls' } };
  const r = runHook(payload, tmp);
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), '');
});

test('post-tool-hook: emits systemMessage for ExitPlanMode when mode is on', () => {
  const tmp = makeTmp();
  writeStateFor(TEST_CWD, { mode: 'on', autoOpen: false }, tmp);

  const payload = {
    tool_name: 'ExitPlanMode',
    cwd: TEST_CWD,
    session_id: 'test-sess',
    tool_input: { plan: PLAN_MD }
  };
  const r = runHook(payload, tmp);
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.ok(typeof out.systemMessage === 'string', 'systemMessage must be a string');
  assert.ok(out.systemMessage.includes('[to-html'), 'systemMessage has to-html prefix');
  assert.ok(out.systemMessage.includes('plan'), 'systemMessage references plan');
});

test('post-tool-hook: systemMessage contains task count and url', () => {
  const tmp = makeTmp();
  writeStateFor(TEST_CWD, { mode: 'on', autoOpen: false }, tmp);

  const payload = {
    tool_name: 'ExitPlanMode',
    cwd: TEST_CWD,
    session_id: 'test-counts',
    tool_input: { plan: PLAN_MD }
  };
  const r = runHook(payload, tmp);
  assert.equal(r.status, 0);
  const { systemMessage } = JSON.parse(r.stdout);
  assert.match(systemMessage, /\d+\/\d+/, 'systemMessage contains completed/total fraction');
  assert.ok(systemMessage.includes('file://'), 'systemMessage contains file:// url');
});

test('post-tool-hook: emits nothing when mode is off', () => {
  const tmp = makeTmp();
  writeStateFor(TEST_CWD, { mode: 'off' }, tmp);

  const payload = {
    tool_name: 'ExitPlanMode',
    cwd: TEST_CWD,
    session_id: 'test-off',
    tool_input: { plan: PLAN_MD }
  };
  const r = runHook(payload, tmp);
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), '');
});

test('post-tool-hook: handles exit_plan_mode alias (snake_case)', () => {
  const tmp = makeTmp();
  writeStateFor(TEST_CWD, { mode: 'on', autoOpen: false }, tmp);

  const payload = {
    tool_name: 'exit_plan_mode',
    cwd: TEST_CWD,
    session_id: 'test-alias',
    tool_input: { plan: PLAN_MD }
  };
  const r = runHook(payload, tmp);
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.ok(typeof out.systemMessage === 'string');
  assert.ok(out.systemMessage.includes('[to-html'));
});

test('post-tool-hook: emits nothing when tool_input has no plan/markdown/body', () => {
  const tmp = makeTmp();
  writeStateFor(TEST_CWD, { mode: 'on', autoOpen: false }, tmp);

  const payload = {
    tool_name: 'ExitPlanMode',
    cwd: TEST_CWD,
    session_id: 'test-noplan',
    tool_input: { other: 'data' }
  };
  const r = runHook(payload, tmp);
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), '');
});

test('post-tool-hook: reads plan from markdown field as fallback', () => {
  const tmp = makeTmp();
  writeStateFor(TEST_CWD, { mode: 'on', autoOpen: false }, tmp);

  const payload = {
    tool_name: 'ExitPlanMode',
    cwd: TEST_CWD,
    session_id: 'test-markdown-field',
    tool_input: { markdown: PLAN_MD }
  };
  const r = runHook(payload, tmp);
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.ok(typeof out.systemMessage === 'string');
});

test('post-tool-hook: reads plan from body field as fallback', () => {
  const tmp = makeTmp();
  writeStateFor(TEST_CWD, { mode: 'on', autoOpen: false }, tmp);

  const payload = {
    tool_name: 'ExitPlanMode',
    cwd: TEST_CWD,
    session_id: 'test-body-field',
    tool_input: { body: PLAN_MD }
  };
  const r = runHook(payload, tmp);
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.ok(typeof out.systemMessage === 'string');
});

test('post-tool-hook: handles toolInput alias (camelCase)', () => {
  const tmp = makeTmp();
  writeStateFor(TEST_CWD, { mode: 'on', autoOpen: false }, tmp);

  const payload = {
    tool_name: 'ExitPlanMode',
    cwd: TEST_CWD,
    session_id: 'test-camel',
    toolInput: { plan: PLAN_MD }
  };
  const r = runHook(payload, tmp);
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.ok(typeof out.systemMessage === 'string');
});

test('post-tool-hook: exits 0 on malformed JSON object', () => {
  const tmp = makeTmp();
  const r = runHook('{broken json [[[', tmp);
  assert.equal(r.status, 0);
});

test('post-tool-hook: exits 0 on null-like payload', () => {
  const tmp = makeTmp();
  const r = runHook('null', tmp);
  assert.equal(r.status, 0);
});
