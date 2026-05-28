'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { composeArtifact } = require('../lib/compose');

const meta = { turnIndex: 1, sessionId: 't', project: 'p' };
const countOf = (h, sub) => h.split(sub).length - 1;

test('diagram: svg has no role="img" (interactive nodes stay in AT tree)', () => {
  const md = '# Flow\n\n```mermaid\ngraph TD\nIngest --> Parse\nParse --> Render\nRender --> Output\n```';
  const { html } = composeArtifact({ markdown: md, meta });
  assert.ok(html.includes('<svg'));
  assert.ok(!/<svg[^>]*role="img"/.test(html));
});

test('diagram: svg retains aria-label="Concept map"', () => {
  const md = '# Flow\n\n```mermaid\ngraph TD\nA --> B\nB --> C\n```';
  const { html } = composeArtifact({ markdown: md, meta });
  assert.ok(html.includes('aria-label="Concept map"'));
});

test('diagram: edge groups have aria-hidden="true"', () => {
  const md = '# Flow\n\n```mermaid\ngraph TD\nA --> B\nB --> C\n```';
  const { html } = composeArtifact({ markdown: md, meta });
  assert.ok(/class="edge" aria-hidden="true"/.test(html));
});

test('every template has exactly one <main>', () => {
  const cases = [
    '# T\n\n' + 'word '.repeat(120),
    '**TL;DR:** s.\n\n## A\n\n' + 'x '.repeat(80) + '\n\n## B\n\n' + 'y '.repeat(80),
    '# Flow\n\n```mermaid\ngraph TD\nA --> B\nB --> C\nA --> C\n```',
    '# Pick\n\n## Option A\n\n- a\n\n## Option B\n\n- b',
    '# Plan\n\n## Phase 1\n\n- [ ] one\n- [ ] two\n\n## Phase 2\n\n- [ ] three'
  ];
  for (const md of cases) {
    const { html } = composeArtifact({ markdown: md, meta });
    assert.equal(countOf(html, '<main'), 1, 'exactly one <main> for: ' + md.slice(0, 20));
  }
});

test('plan: status glyphs have role="img" and aria-label', () => {
  const { html } = composeArtifact({ markdown: '# Plan\n\n## Phase 1\n\n- [ ] alpha task\n- [x] beta task', meta });
  assert.ok(/class="status-glyph" role="img" aria-label="/.test(html));
});

test('plan: status glyph aria-labels map to correct status text', () => {
  const { html } = composeArtifact({ markdown: '# Plan\n\n## Phase 1\n\n- [ ] alpha task\n- [x] beta task', meta });
  assert.ok(html.includes('aria-label="Pending"'));
  assert.ok(html.includes('aria-label="Done"'));
});

test('plan: task-focus checkbox has aria-label with task text', () => {
  const { html } = composeArtifact({ markdown: '# Plan\n\n## Phase 1\n\n- [ ] alpha task\n- [x] beta task', meta });
  assert.ok(/class="task-focus-input" aria-label="Focus: alpha task"/.test(html));
  assert.ok(/class="task-focus-input" aria-label="Focus: beta task"/.test(html));
});

test('comparison: pick-reason input has aria-label', () => {
  const { html } = composeArtifact({ markdown: '# Pick\n\n## Option A\n\n- a\n\n## Option B\n\n- b', meta });
  assert.ok(/id="pick-reason"[^>]*aria-label="Decision reason \(optional\)"/.test(html) ||
    /aria-label="Decision reason \(optional\)"[^>]*id="pick-reason"/.test(html));
});

test('comparison: option radios have aria-label with option title', () => {
  const { html } = composeArtifact({ markdown: '# Pick\n\n## Option A\n\n- a\n\n## Option B\n\n- b', meta });
  const radios = html.match(/type="radio"[^>]*aria-label="Select: [^"]+"/g) || [];
  assert.ok(radios.length >= 2, 'at least 2 option radios with Select: label');
  assert.ok(html.includes('aria-label="Select: Option A"'));
  assert.ok(html.includes('aria-label="Select: Option B"'));
});

test('no duplicate aria-label="Concept map" between section wrapper and svg', () => {
  const md = '# Flow\n\n```mermaid\ngraph TD\nA --> B\nB --> C\nA --> C\n```';
  const { html } = composeArtifact({ markdown: md, meta });
  assert.equal(countOf(html, 'aria-label="Concept map"'), 1);
});

test('no duplicate aria-label="On this page" between section wrapper and nav', () => {
  const md = '**TL;DR:** s.\n\n## Section A\n\n' + 'x '.repeat(80) + '\n\n## Section B\n\n' + 'y '.repeat(80);
  const { html } = composeArtifact({ markdown: md, meta });
  assert.equal(countOf(html, 'aria-label="On this page"'), 1);
});
