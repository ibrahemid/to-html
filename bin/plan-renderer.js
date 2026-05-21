#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { sessionArtifactsDir } = require('../lib/paths');
const { parsePlanMarkdown, mergeTaskStatuses, applyStatusFromText } = require('../lib/plan-extractor');
const { buildPlanDocument } = require('../lib/plan-template');
const { openInBrowser, clickableUrl } = require('../lib/open');
const { readState, writeState } = require('../lib/state');

class PlanRenderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PlanRenderError';
  }
}

function readStdin() {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) return resolve('');
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { data += c; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function renderPlan(input) {
  const {
    markdown,
    sessionId = 'unknown',
    project = '',
    cwd = process.cwd(),
    autoOpen = false,
    source = 'plan',
    assistantText = null,
    titleOverride = null
  } = input;

  if (!markdown || !markdown.trim()) {
    throw new PlanRenderError('Plan markdown is empty');
  }

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
  const html = buildPlanDocument(plan, {
    sessionId,
    project
  });
  fs.writeFileSync(fullPath, html, 'utf8');

  const isNewPlan = !state.activePlan || state.activePlan.planId !== plan.planId;
  writeState(cwd, {
    activePlan: { ...plan, file: fullPath, sessionId }
  });

  if (autoOpen && isNewPlan) {
    try { openInBrowser(fullPath); } catch (_) {}
  }

  return {
    ok: true,
    planId: plan.planId,
    title: plan.title,
    path: fullPath,
    url: clickableUrl(fullPath),
    opened: !!(autoOpen && isNewPlan),
    rerendered: !isNewPlan,
    tasks: plan.phases.reduce((acc, p) => acc + p.tasks.length, 0),
    completed: plan.phases.reduce((acc, p) => acc + p.tasks.filter((t) => t.status === 'completed').length, 0)
  };
}

async function main() {
  try {
    const raw = await readStdin();
    if (!raw.trim()) throw new PlanRenderError('Empty stdin; expected JSON payload with { markdown, sessionId, ... }');
    const payload = JSON.parse(raw);
    const result = await renderPlan(payload);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (err) {
    process.stdout.write(JSON.stringify({ ok: false, error: `${err.name || 'Error'}: ${err.message}` }, null, 2) + '\n');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { renderPlan };
