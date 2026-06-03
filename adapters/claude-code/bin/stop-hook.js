#!/usr/bin/env node
'use strict';

const path = require('path');
const { spawn } = require('child_process');
const { readState, writeState } = require('../lib/state');
const { render } = require('./render');
const { renderPlan } = require('./plan-renderer');
const { readJsonStdin, writeFileAtomic } = require('../lib/io');
const { appendEvent } = require('../lib/diag');
const { classify } = require('../core/lib/classifier');
const preview = require('../lib/preview');
const { chunkInputPath } = require('../lib/paths');
const transcriptAdapter = require('../shared/transcript').getAdapter('claude-code');
const { stripControlLines, collectAssistantTexts, hashText, isStale: isStaleShared } = transcriptAdapter;

const RETRY_DELAY_MS = 500;
const RETRY_MIN_CHARS = 400;
const MAX_RETRIES = 3;
const MAX_LOOKBACK = 12;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Pick the most recent SUBSTANTIVE assistant message — skipping plugin-control
// chatter (the /to-html toggle status, the auto-open question) and anything the
// classifier would skip. This is what the user was actually looking at when they
// toggled, not the toggle's own reply.
function pickRenderTarget(transcriptPath) {
  const texts = collectAssistantTexts(transcriptPath);
  const total = texts.length;
  const start = Math.max(0, total - MAX_LOOKBACK);
  for (let i = total - 1; i >= start; i--) {
    const stripped = stripControlLines(texts[i]);
    if (!stripped) continue;
    const cls = classify(stripped);
    if (cls.template !== 'skip') {
      return { text: stripped, turnIndex: i + 1, template: cls.template };
    }
  }
  return null;
}

function planToMarkdownStub(plan) {
  if (!plan || !Array.isArray(plan.phases) || plan.phases.length === 0) return null;
  const out = [`# ${plan.title || 'Plan'}`, ''];
  const map = { pending: ' ', in_progress: '~', completed: 'x', failed: '!' };
  for (const phase of plan.phases) {
    if (!phase || typeof phase !== 'object') continue;
    out.push(`## ${phase.title || 'Phase'}`);
    out.push('');
    for (const note of (Array.isArray(phase.notes) ? phase.notes : [])) {
      if (typeof note === 'string') { out.push(note); out.push(''); }
    }
    for (const task of (Array.isArray(phase.tasks) ? phase.tasks : [])) {
      if (!task || typeof task.text !== 'string') continue;
      out.push(`- [${map[task.status] || ' '}] ${task.text}`);
    }
    out.push('');
  }
  return out.join('\n');
}

// Resolve the substantive target. CC flushes the final assistant text block to
// the transcript shortly *after* firing the Stop hook, so an early read can miss
// the new reply and surface the previous turn instead. A candidate is "stale" if
// it is empty, too short, or identical to the reply we already rendered
// (lastHash) — the last case means the new reply has not landed yet. Retry a few
// times, accepting the first fresh, substantive read.
async function resolveTarget(transcriptPath, lastHash, opts) {
  const delayMs = opts && Number.isFinite(opts.delayMs) ? opts.delayMs : RETRY_DELAY_MS;
  const maxRetries = opts && Number.isFinite(opts.maxRetries) ? opts.maxRetries : MAX_RETRIES;

  const stale = (t) => isStaleShared(t, lastHash, RETRY_MIN_CHARS);

  let best = pickRenderTarget(transcriptPath);
  const firstLen = best && best.text ? best.text.length : 0;
  let retries = 0;

  while (retries < maxRetries && stale(best)) {
    await sleep(delayMs);
    retries += 1;
    const next = pickRenderTarget(transcriptPath);
    if (!next || !next.text) continue;
    if (!stale(next)) { best = next; break; }
    if (!best || !best.text || next.text.length > best.text.length) best = next;
  }

  if (!best || !best.text) return { text: null, turnIndex: 0, retries, firstLen };
  return { ...best, retries, firstLen };
}

function buildPreviewUpdate(state, { turnIndex: _turnIndex, rendered }) {
  const enrichOn = state.enrich !== 'off';
  const pending = enrichOn && rendered && rendered.skipped === false;
  return { pending };
}

// Bug 2 fix: a trivial / skipped / no-substantive-text turn must still advance the
// preview so an open tab never shows a stale assistant turn.
function advanceTrivial(sessionId, turnIndex, uiDefaults) {
  preview.ensurePreviewHtml(sessionId, uiDefaults);
  preview.writeChunk(sessionId, turnIndex || 0, {
    i: turnIndex || 0,
    title: '(no substantive reply)',
    template: 'trivial',
    rev: 2,
    enriched: false,
    final: true,
    fragment: '<p class="cc-trivial">No substantive reply this turn.</p>'
  });
  preview.updateManifest(sessionId, { turnIndex: turnIndex || 0, pending: false });
}

async function main() {
  // Reentrancy guard: when the detached enricher (which inherits env) somehow
  // triggers a Stop event, this short-circuits so the enricher cannot recurse
  // into rendering. Matches the prompt-hook guard added in T1.
  if (process.env.TO_HTML_ENRICHING === '1') process.exit(0);

  const payload = await readJsonStdin();
  const cwd = (payload && typeof payload.cwd === 'string') ? payload.cwd
    : (process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const state = readState(cwd);

  if (state.mode !== 'on') {
    appendEvent({ kind: 'stop', mode: 'off', cwd, note: 'skipped — mode off' });
    process.exit(0);
  }

  const sessionId = payload.session_id || payload.sessionId || 'unknown';
  const transcriptPath = payload.transcript_path || payload.transcriptPath || null;
  const stable = await resolveTarget(transcriptPath, state.lastRenderedTextHash);
  const text = stable.text;
  const turnIndex = stable.turnIndex;

  if (!text || !text.trim()) {
    advanceTrivial(sessionId, turnIndex, state.uiDefaults);
    appendEvent({ kind: 'stop', mode: 'on', cwd, note: 'trivial turn, preview advanced', firstLen: stable.firstLen, retries: stable.retries });
    process.exit(0);
  }

  const textHash = hashText(text);
  if (state.lastRenderedTextHash === textHash) {
    appendEvent({ kind: 'stop', mode: 'on', cwd, note: 'already rendered (same text)', textLen: text.length, retries: stable.retries });
    process.exit(0);
  }

  const projectName = cwd ? path.basename(cwd) : '';

  const window = (state.renderThreshold && Number.isFinite(state.renderThreshold.manualToggleWindowMs))
    ? state.renderThreshold.manualToggleWindowMs
    : 8000;
  const modeChangedAt = state.modeChangedAt ? Date.parse(state.modeChangedAt) : 0;
  const isManual = modeChangedAt > 0 && (Date.now() - modeChangedAt) <= window;
  const trigger = isManual ? 'manual' : 'auto';

  const messages = [];

  try {
    const result = await render({
      markdown: text,
      sessionId,
      turnIndex,
      project: projectName,
      autoOpen: state.autoOpen === true,
      trigger,
      renderThreshold: state.renderThreshold,
      uiDefaults: state.uiDefaults
    });
    appendEvent({
      kind: 'stop',
      mode: 'on',
      cwd,
      trigger,
      template: result.template || (result.skipped ? 'skip' : null),
      skipped: !!result.skipped,
      reason: result.reason,
      textLen: text.length,
      retries: stable.retries
    });
    if (result.skipped) {
      advanceTrivial(sessionId, turnIndex, state.uiDefaults);
    } else {
      messages.push(`[to-html · ${result.template}] ${result.url}`);
      writeState(cwd, { lastRenderedTextHash: textHash });

      preview.ensurePreviewHtml(sessionId, state.uiDefaults);
      // single-writer invariant: only this serialized Stop hook writes the manifest. The detached enricher (bin/enrich.js) writes only its turn's chunk and never the manifest, so manifest writes never collide.
      const upd = buildPreviewUpdate(state, { turnIndex, rendered: result });
      preview.updateManifest(sessionId, { turnIndex, pending: upd.pending });

      if (upd.pending) {
        try {
          const inputPath = chunkInputPath(sessionId, turnIndex);
          writeFileAtomic(inputPath, JSON.stringify({
            markdown: text, sessionId, turnIndex, project: projectName,
            uiDefaults: state.uiDefaults, renderThreshold: state.renderThreshold,
            enrichModel: state.enrichModel || null
          }));
          const child = spawn(process.execPath, [path.join(__dirname, 'enrich.js'), inputPath], {
            detached: true, stdio: 'ignore',
            env: Object.assign({}, process.env, { TO_HTML_ENRICHING: '1' })
          });
          child.unref();
        } catch (_err) {
          // enrich.js may not exist yet (T10), or spawn failed. Archive + prose chunk already on disk; preview shows prose-only forever for this turn. Acceptable fail-safe.
          appendEvent({ kind: 'enrich-spawn', cwd, error: _err.message });
        }
      }
    }
  } catch (err) {
    appendEvent({ kind: 'stop', mode: 'on', cwd, error: err.message, textLen: text.length, retries: stable.retries });
    messages.push(`[to-html] render failed: ${err.message}`);
  }

  if (state.activePlan && state.activePlan.title) {
    const planMarkdown = planToMarkdownStub(state.activePlan);
    if (planMarkdown) {
      try {
        const planResult = await renderPlan({
          markdown: planMarkdown,
          sessionId,
          cwd,
          project: projectName,
          autoOpen: false,
          source: state.activePlan.source || 'plan',
          assistantText: text,
          titleOverride: state.activePlan.title
        });
        messages.push(`[to-html · plan] ${planResult.completed}/${planResult.tasks} ${planResult.url}`);
      } catch (err) {
        messages.push(`[to-html] plan update failed: ${err.message}`);
      }
    }
  }

  if (messages.length === 0) process.exit(0);

  process.stdout.write(JSON.stringify({ systemMessage: messages.join('\n') }));
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`[to-html] stop-hook fatal: ${err.message}\n`);
    process.exit(0);
  });
}

module.exports = { stripControlLines, collectAssistantTexts, pickRenderTarget, resolveTarget, hashText, buildPreviewUpdate, advanceTrivial };
