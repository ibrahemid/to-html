'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { composeArtifact } = require('../lib/compose');

const meta = { turnIndex: 1, sessionId: 'test', project: 'p' };

test('composeArtifact: salvaged graph renders a map and strips its source from the body', () => {
  const md = '# Overview\n\n' +
    'A reasonably long paragraph that explains how the pieces of the system connect end to end. '.repeat(3) +
    '\n\ngraph TD\nIngest --> Parse\nParse --> Render\nRender --> Output\n\nClosing prose line.';
  const art = composeArtifact({ markdown: md, meta });
  assert.equal(art.hasGraph, true);
  assert.ok(!art.html.includes('graph TD'));
  assert.ok(!art.html.includes('Ingest --'));
  assert.ok(art.html.includes('Ingest'));
});

test('composeArtifact: plain prose with no graph still renders without a map', () => {
  const md = '# Title\n\n' + 'plain sentence. '.repeat(40);
  const art = composeArtifact({ markdown: md, meta });
  assert.equal(art.hasGraph, false);
  assert.ok(art.html.startsWith('<!doctype html>'));
});

test('composeArtifact: section headings get id slugs that match section-index slugs', () => {
  const md = '# Request pipeline\n\n## Ingest\n\nThe ingest stage reads input with enough prose to be a real section here.\n\n## Parse\n\nParsing turns input into tokens with sufficient detail.\n\n## Render\n\nRendering emits output and closes the pipeline.';
  const { html } = composeArtifact({ markdown: md, meta: { turnIndex: 1, sessionId: 't', project: 'p' } });
  assert.ok(/<h[12][^>]*\bid="s-1-request-pipeline"/.test(html));
  assert.ok(/<h2[^>]*\bid="s-2-ingest"/.test(html));
  assert.ok(/<h2[^>]*\bid="s-3-parse"/.test(html));
  assert.ok(/<h2[^>]*\bid="s-4-render"/.test(html));
});

test('composeArtifact: map node slug targets exist as heading ids (click-to-section works)', () => {
  const md = '# Pipeline\n\n```mermaid\ngraph TD\nIngest --> Parse\nParse --> Render\n```\n\n## Ingest\n\nProse about ingest long enough to count as a section body.\n\n## Parse\n\nProse about parse with adequate length here.\n\n## Render\n\nProse about render to finish the page body.';
  const { html } = composeArtifact({ markdown: md, meta: { turnIndex: 1, sessionId: 't', project: 'p' } });
  for (const slug of ['s-2-ingest', 's-3-parse', 's-4-render']) {
    assert.ok(html.includes('id="' + slug + '"'), 'missing heading id ' + slug);
  }
});

test('composeArtifact: heading with inline formatting still gets the right id', () => {
  const md = '## **Bold** Title\n\n' + 'Enough prose to render a real section body here for the test.';
  const { html } = composeArtifact({ markdown: md, meta: { turnIndex: 1, sessionId: 't', project: 'p' } });
  assert.ok(/id="s-1-bold-title"/.test(html));
});
