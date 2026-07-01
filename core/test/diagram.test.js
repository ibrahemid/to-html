'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { assembleArtifact, validateSpec, ArtifactSpecError } = require('../lib/artifact');

const GOLDEN = path.join(__dirname, 'snapshots', '__golden__', 'diagram-basic.html');

function baseSpec() {
  return {
    kind: 'diagram',
    title: 'Flow',
    nodes: [{ id: 'a', label: 'Start' }, { id: 'b', label: 'Middle' }, { id: 'c', label: 'End' }],
    edges: [{ from: 'a', to: 'b', label: 'next' }, { from: 'b', to: 'c' }]
  };
}

test('validateSpec: rejects too few nodes, missing edges, duplicate ids', () => {
  assert.throws(() => validateSpec({ kind: 'diagram', title: 't', nodes: [{ id: 'a', label: 'A' }], edges: [] }), ArtifactSpecError);
  assert.throws(() => validateSpec({ kind: 'diagram', title: 't', nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], edges: [] }), ArtifactSpecError);
  assert.throws(() => validateSpec({ kind: 'diagram', title: 't', nodes: [{ id: 'a', label: 'A' }, { id: 'a', label: 'B' }], edges: [{ from: 'a', to: 'a' }] }), ArtifactSpecError);
});

test('validateSpec: rejects edge referencing unknown node', () => {
  assert.throws(() => validateSpec({
    kind: 'diagram', title: 't',
    nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    edges: [{ from: 'a', to: 'zzz' }]
  }), ArtifactSpecError);
});

test('validateSpec: defaults direction to TD, accepts LR', () => {
  assert.strictEqual(validateSpec(baseSpec()).direction, 'TD');
  assert.strictEqual(validateSpec({ ...baseSpec(), direction: 'lr' }).direction, 'LR');
  assert.strictEqual(validateSpec({ ...baseSpec(), direction: 'bogus' }).direction, 'TD');
});

test('render: emits svg, escapes labels exactly once (no double-escape)', () => {
  const out = assembleArtifact({
    kind: 'diagram',
    title: 'T',
    nodes: [{ id: 'a', label: 'A & <B>' }, { id: 'b', label: 'plain' }],
    edges: [{ from: 'a', to: 'b' }]
  });
  assert.ok(out.html.includes('<svg'));
  assert.ok(out.html.includes('A &amp; &lt;B&gt;'), 'label escaped once');
  assert.ok(!out.html.includes('&amp;amp;'), 'not double-escaped');
  assert.ok(!out.html.includes('A & <B>'), 'raw label not present');
  assert.ok(out.html.includes('.cc-map .node'), 'inlines map.css');
  assert.ok(out.html.includes('.cc-flow'), 'inlines flow.css');
});

test('assembleArtifact: self-contained, deterministic', () => {
  const out = assembleArtifact(baseSpec());
  assert.strictEqual(out.kind, 'diagram');
  assert.ok(out.html.startsWith('<!doctype html>'));
  assert.ok(!/<(?:link|script)[^>]+(?:src|href)=["']https?:/.test(out.html));
  const a = assembleArtifact(baseSpec(), { stamp: 'x' });
  const b = assembleArtifact(baseSpec(), { stamp: 'x' });
  assert.strictEqual(a.html, b.html);
});

test('assembleArtifact: matches golden snapshot', () => {
  const spec = {
    kind: 'diagram',
    title: 'Render pipeline',
    subtitle: 'spec to opened file',
    meta: { project: 'to-html' },
    direction: 'LR',
    nodes: [
      { id: 'spec', label: 'Spec' },
      { id: 'validate', label: 'Validate' },
      { id: 'render', label: 'Render' },
      { id: 'shell', label: 'Build shell' },
      { id: 'open', label: 'Open file' }
    ],
    edges: [
      { from: 'spec', to: 'validate', label: 'author' },
      { from: 'validate', to: 'render', label: 'normalize' },
      { from: 'render', to: 'shell', label: 'assets' },
      { from: 'shell', to: 'open' }
    ]
  };
  const html = assembleArtifact(spec, { stamp: 'to-html' }).html;
  if (process.env.UPDATE_GOLDEN === '1' || !fs.existsSync(GOLDEN)) {
    fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
    fs.writeFileSync(GOLDEN, html);
  }
  assert.strictEqual(html, fs.readFileSync(GOLDEN, 'utf8'));
});
