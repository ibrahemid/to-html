#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const { assembleArtifact, ArtifactSpecError } = require('../core/lib/artifact');
const { readState } = require('../lib/state');
const { readJsonStdin, writeFileAtomic } = require('../lib/io');
const { artifactsDir, assertContained } = require('../lib/paths');
const { openInBrowser, clickableUrl } = require('../lib/open');
const { appendEvent } = require('../lib/diag');

function slugify(title) {
  const base = String(title || 'artifact')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'artifact';
}

function parseArgs(argv) {
  const opts = { specFile: null, out: null, open: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-open') opts.open = false;
    else if (a === '--out') opts.out = argv[++i] || null;
    else if (a === '--spec') opts.specFile = argv[++i] || null;
    else if (!a.startsWith('-') && !opts.specFile) opts.specFile = a;
  }
  return opts;
}

function defaultOutPath(spec, now) {
  const root = artifactsDir();
  const dir = assertContained(root, path.join(root, 'adhoc'));
  fs.mkdirSync(dir, { recursive: true });
  const stamp = Number.isFinite(now) ? now : Date.now();
  return path.join(dir, `${slugify(spec && spec.title)}-${stamp}.html`);
}

// Assemble a spec into a single self-contained file, write it, and (by default)
// open it. open is best-effort: a failed open never fails the artifact.
function runArtifact({ spec, out, open = true, uiDefaults = null, openFn, now, opener = null }) {
  const result = assembleArtifact(spec, { uiDefaults });
  const outPath = out || defaultOutPath(spec, now);
  writeFileAtomic(outPath, result.html);
  if (open) {
    try { (openFn || openInBrowser)(outPath, { app: opener }); } catch (_e) { /* best-effort */ }
  }
  return {
    path: outPath,
    url: clickableUrl(outPath),
    title: result.title,
    kind: result.kind,
    bytes: result.html.length
  };
}

async function loadSpec(opts) {
  if (opts.specFile) return JSON.parse(fs.readFileSync(opts.specFile, 'utf8'));
  return readJsonStdin();
}

function emit(payload) {
  process.stdout.write(JSON.stringify(payload) + '\n');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let spec;
  try {
    spec = await loadSpec(opts);
  } catch (err) {
    emit({ ok: false, error: `could not read spec: ${err.message}` });
    process.exit(1);
  }
  const state = readState();
  try {
    const r = runArtifact({ spec, out: opts.out, open: opts.open, uiDefaults: state.uiDefaults, opener: state.opener });
    appendEvent({ kind: 'artifact', cwd: state.cwd, artifactKind: r.kind, bytes: r.bytes });
    emit({ ok: true, ...r, message: `Artifact ready: ${r.url}` });
    process.exit(0);
  } catch (err) {
    const reason = err instanceof ArtifactSpecError ? `invalid spec: ${err.message}` : err.message;
    appendEvent({ kind: 'artifact', cwd: state.cwd, error: reason });
    emit({ ok: false, error: reason });
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => { emit({ ok: false, error: err.message }); process.exit(1); });
}

module.exports = { runArtifact, parseArgs, slugify, defaultOutPath };
