'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

process.env.XDG_CACHE_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-to-html-render-'));

const { render } = require('../bin/render');

test('render: turnIndex is clamped on invalid input', async () => {
  const r = await render({ markdown: '# Hi\n\n' + 'x '.repeat(300), sessionId: 'test', turnIndex: '../evil' });
  assert.equal(r.turnIndex, 0);
});

test('render: sessionId with traversal is sanitized', async () => {
  const r = await render({ markdown: '# Hi\n\n' + 'x '.repeat(300), sessionId: '../../../tmp/evil', turnIndex: 5 });
  assert.ok(!r.path.includes('../'));
  assert.ok(r.sessionId.startsWith('s-'));
});

test('render: trigger=manual passes through to core (skipped:false on short reply)', async () => {
  const result = await render({ markdown: '# T\n\nshort body that would skip under auto.', trigger: 'manual', sessionId: 'sess-trigger', turnIndex: 1 });
  assert.strictEqual(result.skipped, false);
  assert.ok(result.path && fs.existsSync(result.path));
});
