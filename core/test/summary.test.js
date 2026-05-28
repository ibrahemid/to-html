'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { extractSummary } = require('../lib/summary');

test('extractSummary: explicit **TL;DR:** inline form', () => {
  const md = '**TL;DR:** Ship the gate first.\n\n# Heading\n\nBody text.';
  const { tldr, body } = extractSummary(md);
  assert.equal(tldr, 'Ship the gate first.');
  assert.ok(!/TL;DR/i.test(body));
  assert.ok(body.includes('# Heading'));
});

test('extractSummary: heading-form `## TL;DR`', () => {
  const md = '# Title\n\n## TL;DR\n\nReal summary line one.\nLine two.\n\n## Detail\n\nMore.';
  const { tldr, body } = extractSummary(md);
  assert.match(tldr, /Real summary line one/);
  assert.ok(/Line two/.test(tldr));
  assert.ok(!/TL;DR/i.test(body));
  assert.ok(body.includes('## Detail'));
});

test('extractSummary: returns null when absent — no synthesis', () => {
  const md = '# Title\n\nA paragraph with no summary marker at all.';
  const { tldr, body } = extractSummary(md);
  assert.equal(tldr, null);
  assert.equal(body, md);
});

test('extractSummary: empty / non-string input', () => {
  assert.deepEqual(extractSummary(''), { tldr: null, body: '' });
  assert.deepEqual(extractSummary(null), { tldr: null, body: '' });
  assert.deepEqual(extractSummary(undefined), { tldr: null, body: '' });
});

test('extractSummary: blockquote `> **TL;DR:**` form', () => {
  const md = '> **TL;DR:** Quoted summary.\n\n# Title\n\nBody.';
  const { tldr, body } = extractSummary(md);
  assert.match(tldr, /Quoted summary/);
  assert.ok(!/TL;DR/i.test(body));
});

test('extractSummary: case-insensitive and tldr variant', () => {
  const md = '**tldr:** lowercase works.\n\nbody';
  const { tldr } = extractSummary(md);
  assert.equal(tldr, 'lowercase works.');
});

test('extractSummary: ignores ## TL;DR inside a code fence', () => {
  const md = '## Real\n\nBody.\n\n```\n## TL;DR\n\nFake summary.\n```\n\nAfter.';
  const { tldr, body } = extractSummary(md);
  assert.equal(tldr, null);
  assert.ok(body.includes('## TL;DR'));
  assert.ok(body.includes('Fake summary.'));
});

test('extractSummary: ignores **TL;DR:** inside a code fence', () => {
  const md = 'Intro paragraph.\n\n```\n**TL;DR:** not a real summary\n```\n\nMore prose.';
  assert.equal(extractSummary(md).tldr, null);
});

test('extractSummary: still extracts a real leading TL;DR (regression)', () => {
  assert.equal(extractSummary('**TL;DR:** the real one.\n\nBody.').tldr, 'the real one.');
});

test('extractSummary: still extracts a real ## TL;DR heading (regression)', () => {
  const { tldr } = extractSummary('## TL;DR\n\nThe summary line.\n\n## Details\n\nBody.');
  assert.equal(tldr, 'The summary line.');
});
