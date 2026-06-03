#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { spawn } = require('child_process');
const { render } = require('./render');
const preview = require('../lib/preview');
const { appendEvent } = require('../lib/diag');
const { ENRICHMENT_PROMPT, ENRICHMENT_SCHEMA, parseEnrichment } = require('../shared/enrichment');

const TIMEOUT_MS = 30000;
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

function runClaude(reply, model) {
  return new Promise((resolve) => {
    // TO_HTML_CLAUDE_BIN lets tests inject a fake claude that emits a canned
    // envelope. Production always resolves to 'claude' on PATH.
    const bin = process.env.TO_HTML_CLAUDE_BIN || 'claude';
    const args = [
      '-p',
      '--system-prompt', ENRICHMENT_PROMPT,
      '--model', model,
      '--output-format', 'json',
      '--json-schema', JSON.stringify(ENRICHMENT_SCHEMA),
      '--tools', '',
      '--setting-sources', '',
      '--strict-mcp-config'
    ];
    let out = '';
    let done = false;
    const child = spawn(bin, args, {
      stdio: ['pipe', 'pipe', 'ignore'],
      env: Object.assign({}, process.env, { TO_HTML_ENRICHING: '1' })
    });
    const finish = (val) => { if (!done) { done = true; resolve(val); } };
    // Timeout ownership: the Stop hook has already returned by the time we run
    // here, so the enricher owns the kill. SIGTERM the grandchild claude and
    // resolve null so the caller falls through to markResolved().
    const timer = setTimeout(() => { try { child.kill('SIGTERM'); } catch (_e) {} finish(null); }, TIMEOUT_MS);
    child.stdout.on('data', (d) => { out += d; });
    child.on('error', () => { clearTimeout(timer); finish(null); });
    child.on('exit', () => { clearTimeout(timer); finish(out); });
    try { child.stdin.end(reply); } catch (_e) { /* child may have died; timer/exit resolves */ }
  });
}

function markResolved(input) {
  // The enricher cannot leave the chunk at rev:1 pending forever; the poller
  // would re-fetch every tick and the backstop reload would fire (see T5
  // isTurnPending regression context). On failure, re-emit the SAME prose
  // chunk at rev:2 final so the poller stops polling. We do NOT rewrite the
  // archive on failure; the prose stands.
  const existing = preview.readChunk(input.sessionId, input.turnIndex);
  if (!existing) return;
  try {
    preview.writeChunk(input.sessionId, input.turnIndex,
      Object.assign({}, existing, { rev: 2, enriched: false, final: true }));
  } catch (_e) { /* preview write failure is acceptable; the archive is durable */ }
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath || !fs.existsSync(inputPath)) process.exit(0);
  let input;
  try { input = JSON.parse(fs.readFileSync(inputPath, 'utf8')); } catch { process.exit(0); }
  const { markdown, sessionId, turnIndex } = input;
  const model = input.enrichModel || DEFAULT_MODEL;

  let enrichment = null;
  try {
    const stdout = await runClaude(String(markdown || ''), model);
    enrichment = parseEnrichment(stdout || '');
  } catch (_e) { enrichment = null; }

  if (enrichment) {
    // Success path: rewrite archive + chunk at rev:2 enriched via render().
    try {
      await render({
        markdown, sessionId, turnIndex, project: input.project || '',
        autoOpen: false, trigger: 'manual',
        uiDefaults: input.uiDefaults || null, renderThreshold: input.renderThreshold || null,
        enrichment: { tldr: enrichment.tldr, graph: enrichment.mermaid }
      });
      appendEvent({ kind: 'enrich', sessionId, turnIndex, note: 'enriched' });
    } catch (err) {
      appendEvent({ kind: 'enrich', sessionId, turnIndex, error: err.message });
      markResolved(input);
    }
  } else {
    // Failure path (timeout, parse error, missing binary, validation reject):
    // re-emit prose chunk at rev:2 final so the poller stops. Archive untouched.
    appendEvent({ kind: 'enrich', sessionId, turnIndex, note: 'fail-safe prose-only' });
    markResolved(input);
  }
  try { fs.unlinkSync(inputPath); } catch (_e) { /* best effort cleanup */ }
  process.exit(0);
}

if (require.main === module) {
  main().catch(() => process.exit(0));
}

module.exports = { runClaude, markResolved, TIMEOUT_MS, DEFAULT_MODEL };
