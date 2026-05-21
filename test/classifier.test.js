'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { classify, extractOverride, MAX_OVERRIDE_BYTES } = require('../lib/classifier');

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
