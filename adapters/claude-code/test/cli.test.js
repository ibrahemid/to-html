'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const CLI = path.join(__dirname, '../bin/cli.js');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cc-to-html-cli-'));
}

function run(args, tmp) {
  const stdout = execFileSync('node', [CLI, ...args], {
    env: { ...process.env, XDG_CACHE_HOME: tmp }
  });
  return JSON.parse(stdout.toString('utf8').trim());
}

function runExpectFail(args, tmp) {
  try {
    execFileSync('node', [CLI, ...args], {
      env: { ...process.env, XDG_CACHE_HOME: tmp }
    });
    assert.fail('expected non-zero exit');
  } catch (err) {
    const out = JSON.parse(err.stdout.toString('utf8').trim());
    return out;
  }
}

test('cli status: returns ok with mode and autoOpen', () => {
  const tmp = makeTmp();
  const r = run(['status'], tmp);
  assert.equal(r.ok, true);
  assert.ok(typeof r.mode === 'string', 'mode is a string');
  assert.ok(typeof r.autoOpen === 'boolean', 'autoOpen is a boolean');
  assert.ok(typeof r.message === 'string', 'message is a string');
});

test('cli status: fresh state is mode=off', () => {
  const tmp = makeTmp();
  const r = run(['status'], tmp);
  assert.equal(r.mode, 'off');
  assert.equal(r.autoOpen, false);
  assert.ok(r.message.includes('OFF'));
});

test('cli toggle on: sets mode to on', () => {
  const tmp = makeTmp();
  const r = run(['toggle', 'on'], tmp);
  assert.equal(r.ok, true);
  assert.equal(r.mode, 'on');
  assert.equal(r.changed, true);
});

test('cli toggle on: mode persists across invocations', () => {
  const tmp = makeTmp();
  run(['toggle', 'on'], tmp);
  const r = run(['status'], tmp);
  assert.equal(r.mode, 'on');
});

test('cli toggle on twice: second call reports changed=false', () => {
  const tmp = makeTmp();
  run(['toggle', 'on'], tmp);
  const r = run(['toggle', 'on'], tmp);
  assert.equal(r.ok, true);
  assert.equal(r.mode, 'on');
  assert.equal(r.changed, false);
});

test('cli toggle off: sets mode to off', () => {
  const tmp = makeTmp();
  run(['toggle', 'on'], tmp);
  const r = run(['toggle', 'off'], tmp);
  assert.equal(r.ok, true);
  assert.equal(r.mode, 'off');
  assert.equal(r.changed, true);
});

test('cli toggle (no arg): flips mode from off to on', () => {
  const tmp = makeTmp();
  const before = run(['status'], tmp);
  assert.equal(before.mode, 'off');
  const r = run(['toggle'], tmp);
  assert.equal(r.mode, 'on');
});

test('cli toggle (no arg): flips mode from on to off', () => {
  const tmp = makeTmp();
  run(['toggle', 'on'], tmp);
  const r = run(['toggle'], tmp);
  assert.equal(r.mode, 'off');
});

test('cli toggle status: returns current state without changing it', () => {
  const tmp = makeTmp();
  run(['toggle', 'on'], tmp);
  const r = run(['toggle', 'status'], tmp);
  assert.equal(r.ok, true);
  assert.equal(r.mode, 'on');
  assert.equal(r.changed, false);
});

test('cli toggle reset: sets mode to off and autoOpen to false', () => {
  const tmp = makeTmp();
  run(['toggle', 'on'], tmp);
  run(['set-auto-open', 'yes'], tmp);
  const r = run(['toggle', 'reset'], tmp);
  assert.equal(r.ok, true);
  assert.equal(r.mode, 'off');
  assert.equal(r.autoOpen, false);
  assert.equal(r.changed, true);
});

test('cli toggle invalid arg: exits non-zero with ok:false', () => {
  const tmp = makeTmp();
  const r = runExpectFail(['toggle', 'bogus'], tmp);
  assert.equal(r.ok, false);
  assert.ok(typeof r.error === 'string');
});

test('cli set-auto-open yes: sets autoOpen to true', () => {
  const tmp = makeTmp();
  const r = run(['set-auto-open', 'yes'], tmp);
  assert.equal(r.ok, true);
  assert.equal(r.autoOpen, true);
});

test('cli set-auto-open no: sets autoOpen to false', () => {
  const tmp = makeTmp();
  run(['set-auto-open', 'yes'], tmp);
  const r = run(['set-auto-open', 'no'], tmp);
  assert.equal(r.ok, true);
  assert.equal(r.autoOpen, false);
});

test('cli set-auto-open invalid arg: exits non-zero with ok:false', () => {
  const tmp = makeTmp();
  const r = runExpectFail(['set-auto-open', 'maybe'], tmp);
  assert.equal(r.ok, false);
  assert.ok(typeof r.error === 'string');
});

test('cli config theme dark: updates uiDefaults.theme', () => {
  const tmp = makeTmp();
  const r = run(['config', 'theme', 'dark'], tmp);
  assert.equal(r.ok, true);
  assert.equal(r.uiDefaults.theme, 'dark');
  assert.equal(r.changed, true);
});

test('cli config theme light: updates uiDefaults.theme', () => {
  const tmp = makeTmp();
  const r = run(['config', 'theme', 'light'], tmp);
  assert.equal(r.ok, true);
  assert.equal(r.uiDefaults.theme, 'light');
});

test('cli config size l: updates uiDefaults.size', () => {
  const tmp = makeTmp();
  const r = run(['config', 'size', 'l'], tmp);
  assert.equal(r.ok, true);
  assert.equal(r.uiDefaults.size, 'l');
});

test('cli config width wide: updates uiDefaults.width', () => {
  const tmp = makeTmp();
  const r = run(['config', 'width', 'wide'], tmp);
  assert.equal(r.ok, true);
  assert.equal(r.uiDefaults.width, 'wide');
});

test('cli config font serif: updates uiDefaults.family', () => {
  const tmp = makeTmp();
  const r = run(['config', 'font', 'serif'], tmp);
  assert.equal(r.ok, true);
  assert.equal(r.uiDefaults.family, 'serif');
});

test('cli config theme bogus: exits non-zero with ok:false', () => {
  const tmp = makeTmp();
  const r = runExpectFail(['config', 'theme', 'bogus'], tmp);
  assert.equal(r.ok, false);
  assert.ok(r.error.includes('theme') || r.error.includes('expects'));
});

test('cli config badkey x: exits non-zero with ok:false', () => {
  const tmp = makeTmp();
  const r = runExpectFail(['config', 'badkey', 'x'], tmp);
  assert.equal(r.ok, false);
  assert.ok(typeof r.error === 'string');
});

test('cli config auto-open yes: sets autoOpen via config command', () => {
  const tmp = makeTmp();
  const r = run(['config', 'auto-open', 'yes'], tmp);
  assert.equal(r.ok, true);
  assert.equal(r.autoOpen, true);
});

test('cli config show: returns current state without changing', () => {
  const tmp = makeTmp();
  run(['toggle', 'on'], tmp);
  const r = run(['config', 'show'], tmp);
  assert.equal(r.ok, true);
  assert.equal(r.mode, 'on');
  assert.equal(r.changed, false);
});

test('cli unknown command: exits non-zero with ok:false', () => {
  const tmp = makeTmp();
  const r = runExpectFail(['frobnicate'], tmp);
  assert.equal(r.ok, false);
});

test('cli snapshot includes stateFile and cwd keys', () => {
  const tmp = makeTmp();
  const r = run(['status'], tmp);
  assert.ok(typeof r.stateFile === 'string');
  assert.ok(typeof r.cwd === 'string');
});

test('cli: isolated tmp dirs produce independent state', () => {
  const tmp1 = makeTmp();
  const tmp2 = makeTmp();
  run(['toggle', 'on'], tmp1);
  const r = run(['status'], tmp2);
  assert.equal(r.mode, 'off');
});

test('config enrich on/off persists', () => {
  const tmp = makeTmp();
  const off = run(['config', 'enrich', 'off'], tmp);
  assert.equal(off.ok, true);
  const show = run(['config', 'show'], tmp);
  assert.equal(show.ok, true);
  assert.match(JSON.stringify(show), /"enrich":"off"/);
});

test('config enrich rejects invalid value', () => {
  const tmp = makeTmp();
  const out = runExpectFail(['config', 'enrich', 'maybe'], tmp);
  assert.equal(out.ok, false);
  assert.match(out.error || '', /on|off/i);
});

test('config enrich-model accepts a non-empty model id', () => {
  const tmp = makeTmp();
  const out = run(['config', 'enrich-model', 'claude-haiku-4-5-20251001'], tmp);
  assert.equal(out.ok, true);
});

test('config enrich-model rejects empty', () => {
  const tmp = makeTmp();
  const out = runExpectFail(['config', 'enrich-model', ''], tmp);
  assert.equal(out.ok, false);
});
