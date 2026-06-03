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

const fsR = require('node:fs');
const { chunkPath: chunkPathR } = require('../lib/paths');

test('render: writes a prose chunk at rev 1 when not enriched', async () => {
  const r = await render({ markdown: '# Hi\n\n' + 'x '.repeat(300), sessionId: 'sess-chunk', turnIndex: 4 });
  assert.equal(r.skipped, false);
  const raw = fsR.readFileSync(chunkPathR('sess-chunk', 4), 'utf8');
  assert.ok(raw.includes('"rev":1'));
  assert.ok(raw.includes('"enriched":false'));
});

test('render: enrichment rewrites chunk at rev 2 enriched', async () => {
  const r = await render({
    markdown: '# Hi\n\n' + 'x '.repeat(300), sessionId: 'sess-chunk', turnIndex: 4,
    enrichment: { tldr: 'Done.', graph: 'graph TD\n A-->B' }
  });
  assert.equal(r.skipped, false);
  const raw = fsR.readFileSync(chunkPathR('sess-chunk', 4), 'utf8');
  assert.ok(raw.includes('"rev":2'));
  assert.ok(raw.includes('"enriched":true'));
});
