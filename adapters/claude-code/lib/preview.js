'use strict';

const fs = require('fs');
const { writeFileAtomic } = require('./io');
const { buildPreviewShell } = require('../core/lib/preview-shell');
const { previewHtmlPath, manifestPath, chunkPath } = require('./paths');

function jsonpSafe(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function writeChunk(sessionId, turnIndex, data) {
  const payload = jsonpSafe(data);
  writeFileAtomic(chunkPath(sessionId, turnIndex), `window.__tohtmlChunk(${Number(turnIndex)}, ${payload});\n`);
}

function readChunk(sessionId, turnIndex) {
  const file = chunkPath(sessionId, turnIndex);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^window\.__tohtmlChunk\([0-9]+,\s*([\s\S]*)\);\s*$/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function readManifest(sessionId) {
  const file = manifestPath(sessionId);
  if (!fs.existsSync(file)) return { version: 0, turns: [], updatedAt: null };
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^window\.__tohtmlManifest\(([\s\S]*)\);\s*$/);
  if (!m) return { version: 0, turns: [], updatedAt: null };
  try {
    const parsed = JSON.parse(m[1]);
    if (!parsed || !Array.isArray(parsed.turns)) return { version: 0, turns: [], updatedAt: null };
    return parsed;
  } catch { return { version: 0, turns: [], updatedAt: null }; }
}

// single-writer invariant: only the serialized Stop hook calls updateManifest; the detached enricher never does. This is the lock-free guarantee that the enricher cannot clobber turn N+1 written by a later Stop hook.
function updateManifest(sessionId, { turnIndex, pending, nowIso }) {
  const cur = readManifest(sessionId);
  const turns = cur.turns.slice();
  const idx = turns.findIndex((t) => t.i === turnIndex);
  const entry = { i: turnIndex, pending: !!pending };
  if (idx >= 0) turns[idx] = entry; else turns.push(entry);
  turns.sort((a, b) => a.i - b.i);
  const next = { version: (cur.version || 0) + 1, turns, updatedAt: nowIso || new Date().toISOString() };
  writeFileAtomic(manifestPath(sessionId), `window.__tohtmlManifest(${jsonpSafe(next)});\n`);
  return next;
}

function ensurePreviewHtml(sessionId, uiDefaults) {
  const file = previewHtmlPath(sessionId);
  if (fs.existsSync(file)) return file;
  writeFileAtomic(file, buildPreviewShell({ uiDefaults: uiDefaults || null, title: 'to-html session preview' }));
  return file;
}

module.exports = { writeChunk, readChunk, readManifest, updateManifest, ensurePreviewHtml, jsonpSafe };
