'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildSectionIndex, slugify } = require('../lib/section-index');

test('buildSectionIndex: indexes h1/h2/h3 with stable slugs', () => {
  const md = '# Title\n\n## First\n\nbody\n\n### Sub\n\nmore\n\n## Second';
  const { sections, annotatedMarkdown } = buildSectionIndex(md);
  assert.equal(sections.length, 4);
  assert.deepEqual(sections.map((s) => s.level), [1, 2, 3, 2]);
  assert.deepEqual(sections.map((s) => s.text), ['Title', 'First', 'Sub', 'Second']);
  assert.equal(annotatedMarkdown, md);
});

test('buildSectionIndex: skips fenced-code headings', () => {
  const md = '# Real\n\n```\n## Not a heading\n```\n\n## Also real';
  const { sections } = buildSectionIndex(md);
  assert.deepEqual(sections.map((s) => s.text), ['Real', 'Also real']);
});

test('buildSectionIndex: empty / no-heading input', () => {
  const empty = buildSectionIndex('');
  assert.equal(empty.sections.length, 0);
  const flat = buildSectionIndex('Just a paragraph.');
  assert.equal(flat.sections.length, 0);
  assert.equal(flat.annotatedMarkdown, 'Just a paragraph.');
});

test('buildSectionIndex: idempotent slug shape', () => {
  const { sections } = buildSectionIndex('## Hello, World!\n\n## Hello, World!');
  assert.equal(sections.length, 2);
  assert.notEqual(sections[0].slug, sections[1].slug);
  assert.ok(/^s-1-hello-world$/.test(sections[0].slug));
  assert.ok(/^s-2-hello-world$/.test(sections[1].slug));
});

test('slugify: strips non-alphanumerics, truncates', () => {
  assert.equal(slugify('Hello, World!', 1), 's-1-hello-world');
  assert.equal(slugify('', 5), 's-5-section');
});

test('buildSectionIndex: a ``` line inside a ~~~ block does not drop later headings', () => {
  const md = '## A\n\n~~~\n```\n~~~\n\n## B\n\n## C';
  const { sections } = buildSectionIndex(md);
  assert.deepEqual(sections.map(s => s.text), ['A', 'B', 'C']);
});

test('buildSectionIndex: headings inside a normal ``` block are still excluded', () => {
  const md = '## Real\n\n```\n## NotAHeading\n```\n\n## AlsoReal';
  const { sections } = buildSectionIndex(md);
  assert.deepEqual(sections.map(s => s.text), ['Real', 'AlsoReal']);
});
