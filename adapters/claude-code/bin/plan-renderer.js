#!/usr/bin/env node
'use strict';

const path = require('path');
const { sessionArtifactsDir, safeSessionSegment } = require('../lib/paths');
const { parsePlanMarkdown, mergeTaskStatuses, applyStatusFromText } = require('../lib/plan-extractor');
const planTemplate = require('../lib/templates/plan');
const { buildShell, readAsset } = require('../lib/templates/dispatch');
const { openInBrowser, clickableUrl } = require('../lib/open');
const { readState, writeState } = require('../lib/state');
const { readJsonStdin, writeFileAtomic } = require('../lib/io');

const MAX_PLAN_MARKDOWN_BYTES = 512 * 1024;

class PlanRenderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PlanRenderError';
  }
}

function cappedMarkdown(raw) {
  const value = typeof raw === 'string' ? raw : '';
  if (Buffer.byteLength(value, 'utf8') <= MAX_PLAN_MARKDOWN_BYTES) return value;
  return value.slice(0, MAX_PLAN_MARKDOWN_BYTES) + '\n\n*(plan truncated — exceeded plan size cap)*';
}

async function renderPlan(input) {
  if (!input || typeof input !== 'object') {
    throw new PlanRenderError('renderPlan() requires an input object');
  }
  const markdown = cappedMarkdown(input.markdown);
  if (!markdown || !markdown.trim()) {
    throw new PlanRenderError('Plan markdown is empty');
  }
  const sessionId = safeSessionSegment(input.sessionId);
  const cwd = typeof input.cwd === 'string' ? input.cwd : process.cwd();
  const project = typeof input.project === 'string' ? input.project : '';
  const autoOpen = input.autoOpen === true;
  const source = typeof input.source === 'string' ? input.source : 'plan';
  const assistantText = typeof input.assistantText === 'string' ? input.assistantText : null;
  const titleOverride = typeof input.titleOverride === 'string' ? input.titleOverride : null;

  let plan = parsePlanMarkdown(markdown, { titleOverride, source });

  const state = readState(cwd);
  if (state.activePlan && state.activePlan.planId === plan.planId) {
    plan = mergeTaskStatuses(state.activePlan, plan);
  }
  if (assistantText) {
    plan = applyStatusFromText(plan, assistantText);
  }

  const dir = sessionArtifactsDir(sessionId);
  const filename = `plan-${plan.slug}.html`;
  const fullPath = path.join(dir, filename);

  const rendered = planTemplate.renderFromPlan({
    plan,
    meta: { sessionId, project },
    override: titleOverride ? { title: titleOverride } : null,
    buildShell,
    readAsset,
    tldrHtml: '',
    mapHtml: '',
    chromeHtml: '',
    uiDefaults: state.uiDefaults
  });

  writeFileAtomic(fullPath, rendered.html);

  const isNewPlan = !state.activePlan || state.activePlan.planId !== plan.planId;
  writeState(cwd, {
    activePlan: { ...plan, file: fullPath, sessionId }
  });

  let openError = null;
  if (autoOpen && isNewPlan) {
    try { openInBrowser(fullPath); } catch (err) { openError = err.message; }
  }

  return {
    ok: true,
    planId: plan.planId,
    title: plan.title,
    path: fullPath,
    url: clickableUrl(fullPath),
    opened: !!(autoOpen && isNewPlan) && !openError,
    openError,
    rerendered: !isNewPlan,
    tasks: plan.phases.reduce((acc, p) => acc + p.tasks.length, 0),
    completed: plan.phases.reduce((acc, p) => acc + p.tasks.filter((t) => t.status === 'completed').length, 0)
  };
}

async function main() {
  try {
    const input = await readJsonStdin();
    if (!input || Object.keys(input).length === 0) throw new PlanRenderError('Empty stdin');
    const result = await renderPlan(input);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (err) {
    process.stdout.write(JSON.stringify({ ok: false, error: `${err.name || 'Error'}: ${err.message}` }, null, 2) + '\n');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { renderPlan, MAX_PLAN_MARKDOWN_BYTES };
