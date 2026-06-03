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

test('composeArtifact: enrichment.tldr fills the TL;DR band when reply has none', () => {
  const md = '# Title\n\n' + 'Body sentence. '.repeat(40);
  const art = composeArtifact({ markdown: md, enrichment: { tldr: 'Enriched summary.', graph: '' } });
  assert.ok(art.hasTldr, 'tldr band present from enrichment');
  assert.ok(art.html.includes('Enriched summary.'));
  assert.ok(art.fragment.includes('Enriched summary.'));
});

test('composeArtifact: enrichment.graph renders a map without a fenced block in the body', () => {
  const md = '# Title\n\n' + 'Body sentence. '.repeat(40);
  const art = composeArtifact({ markdown: md, enrichment: { tldr: 'S.', graph: 'graph TD\n A[One]-->B[Two]' } });
  assert.ok(art.hasGraph, 'graph rendered from enrichment');
});

test('composeArtifact: invalid enrichment.graph drops the map, keeps tldr', () => {
  const md = '# Title\n\n' + 'Body sentence. '.repeat(40);
  const art = composeArtifact({ markdown: md, enrichment: { tldr: 'S.', graph: 'garbage not mermaid' } });
  assert.equal(art.hasGraph, false);
  assert.ok(art.hasTldr);
});

test('composeArtifact: enrichment tldr is HTML-escaped (XSS)', () => {
  const md = '# Title\n\n' + 'Body sentence. '.repeat(40);
  const art = composeArtifact({ markdown: md, enrichment: { tldr: '<script>alert(1)</script>', graph: '' } });
  assert.ok(!art.html.includes('<script>alert(1)</script>'));
  assert.ok(!art.fragment.includes('<script>alert(1)</script>'));
});

test('composeArtifact: fragment contains body but no doctype/head/main chrome', () => {
  const md = '# Title\n\n' + 'Body sentence. '.repeat(40);
  const art = composeArtifact({ markdown: md });
  assert.ok(typeof art.fragment === 'string' && art.fragment.length > 0);
  assert.ok(!/<!doctype html>/i.test(art.fragment));
  assert.ok(!art.fragment.includes('<head>'));
  assert.ok(!/<main[\s>]/.test(art.fragment), 'fragment must not carry a document-level <main>');
});

test('composeArtifact: comparison fragment drops <main> and the decision-bar', () => {
  const md = '# Compare\n\n## Option A\n\nPros: fast\n\n## Option B\n\nPros: simple\n\n' + 'context body sentence. '.repeat(40);
  const art = composeArtifact({ markdown: md });
  assert.equal(art.template, 'comparison');
  assert.ok(!/<main[\s>]/.test(art.fragment), 'no document-level main in fragment');
  assert.ok(!art.fragment.includes('decision-bar'), 'inert decision-bar stripped');
  assert.ok(art.fragment.includes('cc-main'), 'cc-main class preserved as a div');
});
