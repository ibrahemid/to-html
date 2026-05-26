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
