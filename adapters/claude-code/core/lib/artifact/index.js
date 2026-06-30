'use strict';

const { buildShell, readAsset } = require('../templates/dispatch');
const { validateSpec, ArtifactSpecError } = require('./spec');
const dashboard = require('./dashboard');

const KIND_RENDERERS = { dashboard: dashboard.render };

// Spec-driven assembly: the model authors a structured spec, this turns it into a
// single self-contained HTML document via the shared shell primitive. Deterministic
// given (spec, opts): no timestamps unless passed in opts.stamp.
function assembleArtifact(spec, opts = {}) {
  const norm = validateSpec(spec);
  const renderKind = KIND_RENDERERS[norm.kind];
  if (!renderKind) throw new ArtifactSpecError(`no renderer for kind: ${norm.kind}`);
  const out = renderKind(norm);
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

module.exports = { assembleArtifact, validateSpec, ArtifactSpecError, KIND_RENDERERS };
