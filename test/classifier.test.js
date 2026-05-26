'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { classify, extractOverride, MAX_OVERRIDE_BYTES, shouldRender, countSignals } = require('../lib/classifier');

test('classify: empty markdown skips', () => {
  assert.equal(classify('').template, 'skip');
  assert.equal(classify('   \n\n').template, 'skip');
});

test('classify: one-line ack skips', () => {
  assert.equal(classify('HTML mode: ON').template, 'skip');
  assert.equal(classify('Done.').template, 'skip');
});

test('classify: prose for medium paragraph with no structure', () => {
  const md = 'A '.repeat(200) + 'tail of text.';
  assert.equal(classify(md).template, 'prose');
});

test('classify: heading + para is prose, never skipped', () => {
  assert.equal(classify('# Title\n\nShort body.').template, 'prose');
});

test('classify: comparison via two `## Option X` headings', () => {
  const md = '# Pick one\n\n## Option A: First\n\nPros\n- a\n\n## Option B: Second\n\nPros\n- b';
  assert.equal(classify(md).template, 'comparison');
});

test('classify: plan via two `## Phase N:` headings', () => {
  const md = '# Plan\n\n## Phase 1: Discovery\n\n- task\n\n## Phase 2: Build\n\n- task';
  assert.equal(classify(md).template, 'plan');
});

test('classify: plan via 3+ checkboxes', () => {
  const md = '- [ ] a\n- [ ] b\n- [x] c';
  assert.equal(classify(md).template, 'plan');
});

test('classify: explainer via TL;DR', () => {
  const md = '# Topic\n\nTL;DR: it works like this.\n\n## Detail';
  assert.equal(classify(md).template, 'explainer');
});

test('classify: comparison beats plan when both could match', () => {
  const md = '## Phase 1\n\n## Option A\n\n## Option B';
  assert.equal(classify(md).template, 'comparison');
});

test('extractOverride: valid block forces template', () => {
  const md = '```to-html\n{"template":"comparison","title":"Forced"}\n```\n\nbody';
  const { override, stripped } = extractOverride(md);
  assert.equal(override.template, 'comparison');
  assert.equal(override.title, 'Forced');
  assert.equal(stripped, 'body');
});

test('extractOverride: unknown template falls back to no override', () => {
  const md = '```to-html\n{"template":"hacked"}\n```';
  const { override } = extractOverride(md);
  assert.equal(override, null);
});

test('extractOverride: skip template rejected', () => {
  const md = '```to-html\n{"template":"skip"}\n```';
  const { override } = extractOverride(md);
  assert.equal(override, null);
});

test('extractOverride: broken JSON safely ignored', () => {
  const md = '```to-html\n{not json}\n```';
  const { override, stripped } = extractOverride(md);
  assert.equal(override, null);
  assert.equal(stripped, '');
});

test('extractOverride: oversized body rejected', () => {
  const huge = 'x'.repeat(MAX_OVERRIDE_BYTES + 1);
  const md = '```to-html\n' + JSON.stringify({ template: 'prose', big: huge }) + '\n```';
  const { override } = extractOverride(md);
  assert.equal(override, null);
});

test('classify: no body returns skip', () => {
  assert.equal(classify(undefined).template, 'skip');
  assert.equal(classify(null).template, 'skip');
});

test('classify: code block alone is not skipped', () => {
  const md = '```js\nconst x = 1;\n```';
  const result = classify(md);
  assert.notEqual(result.template, 'skip');
});

test('classify: huge prose stays prose', () => {
  const md = 'lorem '.repeat(2000);
  assert.equal(classify(md).template, 'prose');
});

test('shouldRender: short flat reply is gated out', () => {
  const md = 'A short paragraph with one sentence and a tail.';
  const sig = countSignals(md);
  const gate = shouldRender(sig, md);
  assert.equal(gate.render, false);
  assert.equal(gate.reason, 'gate:short-flat');
});

test('shouldRender: long enough by chars alone passes', () => {
  const md = 'a '.repeat(400);
  const sig = countSignals(md);
  const gate = shouldRender(sig, md);
  assert.equal(gate.render, true);
  assert.equal(gate.reason, 'length');
});

test('shouldRender: two headings pass even on short content', () => {
  const md = '## A\n\nshort\n\n## B\n\nshort';
  const sig = countSignals(md);
  const gate = shouldRender(sig, md);
  assert.equal(gate.render, true);
  assert.equal(gate.reason, 'headings');
});

test('shouldRender: any code block passes', () => {
  const md = 'short\n\n```js\nx\n```\n';
  const sig = countSignals(md);
  const gate = shouldRender(sig, md);
  assert.equal(gate.render, true);
  assert.equal(gate.reason, 'code');
});

test('shouldRender: explicit mermaid block passes', () => {
  const md = 'short text\n\n```mermaid\ngraph TD\nA-->B\n```\n';
  const sig = countSignals(md);
  const gate = shouldRender(sig, md);
  assert.equal(gate.render, true);
});

test('shouldRender: custom thresholds override defaults', () => {
  const md = 'a '.repeat(300);
  const sig = countSignals(md);
  const strict = shouldRender(sig, md, { minChars: 1500 });
  assert.equal(strict.render, false);
  const lax = shouldRender(sig, md, { minChars: 100 });
  assert.equal(lax.render, true);
});

test('shouldRender: passes an unfenced meaningful graph with reason graph-salvage', () => {
  const md = 'graph TD\nA --> B\nB --> C\nA --> C';
  const r = shouldRender(countSignals(md), md);
  assert.equal(r.render, true);
  assert.equal(r.reason, 'graph-salvage');
});

test('shouldRender: prose merely mentioning a graph stays gated out', () => {
  const md = 'We considered the graph TD approach but dropped it.';
  const r = shouldRender(countSignals(md), md);
  assert.equal(r.render, false);
});

test('classify: an unfenced meaningful graph is not skipped', () => {
  assert.notEqual(classify('graph TD\nA --> B\nB --> C\nA --> C').template, 'skip');
});

test('classify: a trivial reply is still skipped', () => {
  assert.equal(classify('ok, done.').template, 'skip');
});
