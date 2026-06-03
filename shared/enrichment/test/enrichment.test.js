'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ENRICHMENT_PROMPT, ENRICHMENT_SCHEMA, parseEnrichment } = require('../index');

function envelope(extra) {
  return JSON.stringify({ type: 'result', subtype: 'success', is_error: false, ...extra });
}

test('ENRICHMENT_PROMPT is a non-empty neutral instruction', () => {
  assert.equal(typeof ENRICHMENT_PROMPT, 'string');
  assert.ok(ENRICHMENT_PROMPT.length > 40);
});

test('ENRICHMENT_SCHEMA requires tldr and mermaid strings', () => {
  assert.deepEqual(ENRICHMENT_SCHEMA.required, ['tldr', 'mermaid']);
  assert.equal(ENRICHMENT_SCHEMA.properties.tldr.type, 'string');
  assert.equal(ENRICHMENT_SCHEMA.properties.mermaid.type, 'string');
});

test('parseEnrichment: success envelope yields trimmed tldr + mermaid', () => {
  const out = parseEnrichment(envelope({
    structured_output: { tldr: '  A summary.  ', mermaid: '  graph TD\n  A-->B  ' }
  }));
  assert.deepEqual(out, { tldr: 'A summary.', mermaid: 'graph TD\n  A-->B' });
});

test('parseEnrichment: empty mermaid is allowed (graph optional)', () => {
  const out = parseEnrichment(envelope({ structured_output: { tldr: 'x', mermaid: '' } }));
  assert.deepEqual(out, { tldr: 'x', mermaid: '' });
});

test('parseEnrichment: empty stdout -> null', () => {
  assert.equal(parseEnrichment(''), null);
});

test('parseEnrichment: non-JSON -> null', () => {
  assert.equal(parseEnrichment('not json {'), null);
});

test('parseEnrichment: error envelope (is_error:true) -> null', () => {
  assert.equal(parseEnrichment(JSON.stringify({ type: 'result', is_error: true, api_error_status: 404 })), null);
});

test('parseEnrichment: missing structured_output -> null', () => {
  assert.equal(parseEnrichment(envelope({})), null);
});

test('parseEnrichment: non-string tldr -> null', () => {
  assert.equal(parseEnrichment(envelope({ structured_output: { tldr: 42, mermaid: 'graph TD' } })), null);
});

test('parseEnrichment: wrong type field -> null', () => {
  assert.equal(parseEnrichment(JSON.stringify({ type: 'system', structured_output: { tldr: 'x', mermaid: '' } })), null);
});

test('parseEnrichment: empty/whitespace tldr -> null (nothing to show)', () => {
  assert.equal(parseEnrichment(envelope({ structured_output: { tldr: '   ', mermaid: 'graph TD' } })), null);
});
