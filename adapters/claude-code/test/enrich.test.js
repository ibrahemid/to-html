'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// Set XDG_CACHE_HOME once before any require so paths.js (which reads
// process.env.XDG_CACHE_HOME at call time) and the spawned enrich.js child
// (which inherits this env) agree on the cache root.
const CACHE = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-enrich-'));
process.env.XDG_CACHE_HOME = CACHE;

const ENRICH = path.join(__dirname, '..', 'bin', 'enrich.js');
const { chunkInputPath, chunkPath } = require('../lib/paths');
const { render } = require('../bin/render');

function fakeClaude(body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-fakeclaude-'));
  const bin = path.join(dir, 'claude');
  fs.writeFileSync(bin, `#!/usr/bin/env node\n${body}\n`, { mode: 0o755 });
  return bin;
}

async function seedProse(sessionId, turnIndex, markdown) {
  // Drop the prose chunk via render() first so markResolved() has something
  // to re-emit. Then write the input.json the enricher will read.
  await render({ markdown, sessionId, turnIndex });
  const inputObj = { markdown, sessionId, turnIndex, project: '', uiDefaults: null, renderThreshold: null };
  fs.writeFileSync(chunkInputPath(sessionId, turnIndex), JSON.stringify(inputObj));
}

test('enrich.js: successful envelope rewrites chunk at rev 2 enriched', async () => {
  const sessionId = 'sess-7';
  const turnIndex = 7;
  await seedProse(sessionId, turnIndex, '# Hi\n\n' + 'word '.repeat(200));
  const claude = fakeClaude("process.stdout.write(JSON.stringify({type:'result',subtype:'success',is_error:false,structured_output:{tldr:'Fake summary.',mermaid:'graph TD\\n A-->B'}}));");
  execFileSync(process.execPath, [ENRICH, chunkInputPath(sessionId, turnIndex)], {
    env: { ...process.env, TO_HTML_CLAUDE_BIN: claude }, encoding: 'utf8'
  });
  const raw = fs.readFileSync(chunkPath(sessionId, turnIndex), 'utf8');
  assert.ok(raw.includes('"rev":2'), 'chunk advanced to rev 2');
  assert.ok(raw.includes('Fake summary'), 'enriched tldr present in chunk');
});

test('enrich.js: malformed envelope leaves prose chunk + rev 2 final (no enriched flag)', async () => {
  const sessionId = 'sess-8';
  const turnIndex = 8;
  await seedProse(sessionId, turnIndex, '# Hi\n\n' + 'word '.repeat(200));
  const claude = fakeClaude("process.stdout.write('not json');");
  execFileSync(process.execPath, [ENRICH, chunkInputPath(sessionId, turnIndex)], {
    env: { ...process.env, TO_HTML_CLAUDE_BIN: claude }, encoding: 'utf8'
  });
  const raw = fs.readFileSync(chunkPath(sessionId, turnIndex), 'utf8');
  assert.ok(raw.includes('"rev":2'), 'final marker advances rev');
  assert.ok(raw.includes('"final":true'), 'chunk marked final');
  assert.ok(!raw.includes('"enriched":true'), 'enrichment did not land');
});

test('enrich.js: spawn argv contains the locked flags + sentinel env', async () => {
  const sessionId = 'sess-9';
  const turnIndex = 9;
  await seedProse(sessionId, turnIndex, '# Hi\n\n' + 'word '.repeat(200));
  const recordFile = path.join(CACHE, 'argv-sess-9.json');
  const claude = fakeClaude(`const fs=require('fs');fs.writeFileSync(${JSON.stringify(recordFile)}, JSON.stringify({argv:process.argv.slice(2),sentinel:process.env.TO_HTML_ENRICHING}));process.stdout.write(JSON.stringify({type:'result',subtype:'success',is_error:false,structured_output:{tldr:'x',mermaid:''}}));`);
  execFileSync(process.execPath, [ENRICH, chunkInputPath(sessionId, turnIndex)], {
    env: { ...process.env, TO_HTML_CLAUDE_BIN: claude }, encoding: 'utf8'
  });
  const rec = JSON.parse(fs.readFileSync(recordFile, 'utf8'));
  assert.ok(rec.argv.includes('-p'));
  assert.ok(rec.argv.includes('--output-format'));
  assert.ok(rec.argv.includes('json'));
  assert.ok(rec.argv.includes('--system-prompt'));
  assert.ok(rec.argv.includes('--json-schema'));
  assert.ok(rec.argv.includes('--tools'));
  assert.ok(rec.argv.includes('--setting-sources'));
  assert.ok(rec.argv.includes('--strict-mcp-config'));
  assert.equal(rec.sentinel, '1');
});
