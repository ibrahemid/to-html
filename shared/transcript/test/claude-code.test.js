'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cc = require('../claude-code');

function tmpFile(lines) {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'to-html-cc-')), 'transcript.jsonl');
  fs.writeFileSync(p, lines.join('\n'));
  return p;
}

test('extractTextFromContent: string passes through', () => {
  assert.strictEqual(cc.extractTextFromContent('hello'), 'hello');
});

test('extractTextFromContent: text blocks are concatenated with blank lines', () => {
  assert.strictEqual(
    cc.extractTextFromContent([
      { type: 'text', text: 'one' },
      { type: 'tool_use', id: 'x' },
      { type: 'text', text: 'two' }
    ]),
    'one\n\ntwo'
  );
});

test('extractTextFromContent: non-array, non-string returns empty', () => {
  assert.strictEqual(cc.extractTextFromContent(null), '');
  assert.strictEqual(cc.extractTextFromContent({ type: 'text' }), '');
});

test('collectAssistantTexts: returns only assistant text', () => {
  const p = tmpFile([
    JSON.stringify({ type: 'user', message: { content: 'hi' } }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'first' }] } }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'second' }] } })
  ]);
  assert.deepStrictEqual(cc.collectAssistantTexts(p), ['first', 'second']);
});

test('collectAssistantTexts: returns [] for missing path', () => {
  assert.deepStrictEqual(cc.collectAssistantTexts('/nonexistent/path'), []);
});

test('collectAssistantTexts: tail-reads when file exceeds maxBytes', () => {
  const head = 'X'.repeat(2048);
  const tail = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'tail-text' }] } });
  const p = tmpFile([head, tail]);
  const out = cc.collectAssistantTexts(p, 512);
  assert.deepStrictEqual(out, ['tail-text']);
});

test('stripControlLines: removes HTML mode + auto-open + [to-html ...] lines', () => {
  const text = [
    '[to-html · prose] file://x',
    'HTML mode: ON · auto-open: no',
    'Auto-open generated HTML files? yes/no',
    'real body line'
  ].join('\n');
  assert.strictEqual(cc.stripControlLines(text), 'real body line');
});

test('hashText: stable 16-hex slice of sha1', () => {
  const h = cc.hashText('abc');
  assert.match(h, /^[0-9a-f]{16}$/);
  assert.strictEqual(h, cc.hashText('abc'));
  assert.notStrictEqual(h, cc.hashText('abcd'));
});

test('isStale: empty, too-short, or matching lastHash is stale', () => {
  assert.ok(cc.isStale(null, null, 400));
  assert.ok(cc.isStale({ text: '' }, null, 400));
  assert.ok(cc.isStale({ text: 'x'.repeat(10) }, null, 400));
  const t = 'x'.repeat(500);
  assert.ok(cc.isStale({ text: t }, cc.hashText(t), 400));
  assert.ok(!cc.isStale({ text: t }, null, 400));
});
