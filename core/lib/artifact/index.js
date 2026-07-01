'use strict';

const fs = require('fs');
const path = require('path');
const { buildShell, readAsset } = require('../templates/dispatch');
const { ArtifactSpecError } = require('./util');

// Auto-discover kinds: each file in kinds/ exports { kind, validate, render }.
// Adding a kind is dropping one file here; nothing else needs editing.
const KINDS_DIR = path.join(__dirname, 'kinds');
const KINDS = {};
for (const file of fs.readdirSync(KINDS_DIR)) {
  if (!file.endsWith('.js')) continue;
  const mod = require(path.join(KINDS_DIR, file));
  if (mod && typeof mod.kind === 'string' && typeof mod.validate === 'function' && typeof mod.render === 'function') {
    KINDS[mod.kind] = mod;
  }
}

function resolveKind(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new ArtifactSpecError('spec must be an object');
  }
  const kind = typeof spec.kind === 'string' ? spec.kind : '';
  const mod = KINDS[kind];
  if (!mod) {
    throw new ArtifactSpecError(`unknown artifact kind: ${kind || '(missing)'} (known: ${Object.keys(KINDS).sort().join(', ')})`);
  }
  return mod;
}

function validateSpec(spec) {
  return resolveKind(spec).validate(spec);
}

// Spec-driven assembly: the model authors a structured spec, this turns it into a
// single self-contained HTML document. Deterministic given (spec, opts).
function assembleArtifact(spec, opts = {}) {
  const mod = resolveKind(spec);
  const norm = mod.validate(spec);
  const out = mod.render(norm);
  const styles = (out.styleAssets || []).map(readAsset).join('\n');
  const scripts = (out.scriptAssets || []).map((name) => `<script>${readAsset(name)}</script>`).join('\n');
  const html = buildShell({
    classname: out.classname,
    title: norm.title,
    styles,
    body: out.body,
    scripts,
    skipMainWrapper: true,
    uiDefaults: opts.uiDefaults || null,
    stamp: opts.stamp || null
  });
  return { html, title: norm.title, kind: norm.kind };
}

function knownKinds() {
  return Object.keys(KINDS).sort();
}

module.exports = { assembleArtifact, validateSpec, ArtifactSpecError, knownKinds, KINDS };
