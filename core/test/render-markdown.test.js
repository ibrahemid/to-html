'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { renderMarkdown } = require('../lib/index');

const META = { turnIndex: 1, sessionId: 'test', project: '' };
const FIXED = '2026-05-28T00:00:00.000Z';

test('renderMarkdown: empty returns skipped', () => {
  const r = renderMarkdown('', { trigger: 'auto', meta: META });
  assert.strictEqual(r.skipped, true);
  assert.strictEqual(r.reason, 'empty-markdown');
});

test('renderMarkdown: trivial returns skipped under auto', () => {
  const r = renderMarkdown('hi', { trigger: 'auto', meta: META });
  assert.strictEqual(r.skipped, true);
});

test('renderMarkdown: manual trigger bypasses the gate', () => {
  const r = renderMarkdown('# Title\n\nSome body that is short.', { trigger: 'manual', meta: META });
  assert.strictEqual(r.skipped, false);
  assert.ok(r.html.includes('<html'));
});

test('renderMarkdown: salvages bare graph and strips source', () => {
  const md = 'graph TD\nA-->B\nB-->C\nC-->D\n\n## A\nbody\n## B\nbody\n## C\nbody\n## D\nbody';
  const r = renderMarkdown(md, { trigger: 'auto', meta: META });
  assert.strictEqual(r.skipped, false);
  assert.ok(r.hasGraph);
  assert.ok(!r.html.includes('graph TD\nA-->B'));
});

test('renderMarkdown: override fence forces template', () => {
  const md = '```to-html\n{"template":"prose"}\n```\n\n# Body';
  const r = renderMarkdown(md, { trigger: 'auto', meta: META });
  assert.strictEqual(r.template, 'prose');
});

test('renderMarkdown: caps oversize input', () => {
  const big = 'word '.repeat(800000);
  const r = renderMarkdown(big, { trigger: 'manual', meta: META, maxMarkdownBytes: 64 * 1024 });
  assert.ok(r.html.includes('content truncated'));
});

test('renderMarkdown: HTML-escapes script tags in title and body', () => {
  const md = '# T <script>alert(1)</script>\n\nbody <script>x</script>';
  const r = renderMarkdown(md, { trigger: 'manual', meta: META });
  assert.ok(!r.html.includes('<script>alert(1)</script>'));
  assert.ok(!r.html.includes('<script>x</script>'));
});

test('renderMarkdown: nowIso threads through plan template for determinism', () => {
  const md = '# Plan\n## Phase 1\n- [ ] one\n- [ ] two';
  const a = renderMarkdown(md, { trigger: 'manual', meta: META, nowIso: FIXED });
  const b = renderMarkdown(md, { trigger: 'manual', meta: META, nowIso: FIXED });
  assert.strictEqual(a.html, b.html);
  assert.ok(a.html.includes(FIXED));
});

test('renderMarkdown: returns full record shape', () => {
  const r = renderMarkdown('# T\n\n' + 'word '.repeat(200), { trigger: 'manual', meta: META });
  for (const k of ['html', 'template', 'title', 'reason', 'skipped', 'hasTldr', 'hasGraph', 'sectionCount']) {
    assert.ok(k in r, `missing key: ${k}`);
  }
});

test('renderMarkdown: passes enrichment through and exposes fragment', () => {
  const md = '# Title\n\n' + 'Body sentence. '.repeat(40);
  const r = renderMarkdown(md, { trigger: 'manual', enrichment: { tldr: 'E.', graph: 'graph TD\n A-->B' } });
  assert.equal(r.skipped, false);
  assert.ok(r.hasTldr && r.hasGraph);
  assert.ok(typeof r.fragment === 'string' && r.fragment.includes('E.'));
});
