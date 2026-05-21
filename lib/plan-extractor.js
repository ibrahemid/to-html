'use strict';

const crypto = require('crypto');

class PlanExtractError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PlanExtractError';
  }
}

function stableId(prefix, text) {
  return `${prefix}-${crypto.createHash('sha1').update(text).digest('hex').slice(0, 10)}`;
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'plan';
}

function parseTaskLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const bulletMatch = trimmed.match(/^[-*+]\s+(.*)$/);
  const numberedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
  const body = bulletMatch ? bulletMatch[1] : numberedMatch ? numberedMatch[1] : null;
  if (!body) return null;
  const checkboxMatch = body.match(/^\[([ xX!~/])\]\s*(.*)$/);
  let status = 'pending';
  let text = body;
  if (checkboxMatch) {
    const marker = checkboxMatch[1].toLowerCase();
    text = checkboxMatch[2];
    if (marker === 'x') status = 'completed';
    else if (marker === '!') status = 'failed';
    else if (marker === '~') status = 'in_progress';
    else if (marker === '/') status = 'in_progress';
  }
  return { text: text.trim(), status };
}

function parsePlanMarkdown(markdown, options = {}) {
  if (typeof markdown !== 'string' || !markdown.trim()) {
    throw new PlanExtractError('Plan markdown is empty');
  }
  const lines = markdown.split('\n');
  let title = options.titleOverride || null;
  const phases = [];
  let currentPhase = null;
  let currentNote = [];

  function flushNote() {
    if (currentPhase && currentNote.length > 0) {
      const text = currentNote.join('\n').trim();
      if (text) currentPhase.notes.push(text);
    }
    currentNote = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    const h1 = line.match(/^#\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    const h3 = line.match(/^###\s+(.*)$/);

    if (h1 && !title) {
      title = h1[1].trim();
      continue;
    }
    if (h2) {
      flushNote();
      const phaseTitle = h2[1].trim();
      currentPhase = {
        id: stableId('phase', phaseTitle),
        title: phaseTitle,
        tasks: [],
        notes: []
      };
      phases.push(currentPhase);
      continue;
    }
    if (h3 && currentPhase) {
      flushNote();
      currentNote.push(`#### ${h3[1].trim()}`);
      continue;
    }

    const task = currentPhase ? parseTaskLine(line) : null;
    if (task) {
      flushNote();
      currentPhase.tasks.push({
        id: stableId('task', `${currentPhase.title}::${task.text}`),
        text: task.text,
        status: task.status
      });
      continue;
    }
    if (currentPhase) {
      currentNote.push(line);
    }
  }
  flushNote();

  if (phases.length === 0) {
    const tasks = [];
    for (const line of lines) {
      const t = parseTaskLine(line);
      if (t) {
        tasks.push({
          id: stableId('task', `default::${t.text}`),
          text: t.text,
          status: t.status
        });
      }
    }
    if (tasks.length === 0) {
      throw new PlanExtractError('No phases or tasks found in plan');
    }
    phases.push({
      id: stableId('phase', 'plan'),
      title: 'Plan',
      tasks,
      notes: []
    });
  }

  const finalTitle = title || (phases[0] && phases[0].title) || 'Plan';
  const planId = stableId('plan', `${finalTitle}::${phases.map((p) => p.id).join('|')}`);

  return {
    planId,
    title: finalTitle,
    slug: slugify(finalTitle),
    phases,
    createdAt: new Date().toISOString(),
    source: options.source || 'unknown'
  };
}

function mergeTaskStatuses(existing, incoming) {
  if (!existing) return incoming;
  const byId = new Map();
  for (const phase of existing.phases) {
    for (const task of phase.tasks) byId.set(task.id, task);
  }
  for (const phase of incoming.phases) {
    for (const task of phase.tasks) {
      const prior = byId.get(task.id);
      if (prior && prior.status !== 'pending') {
        task.status = prior.status;
      }
    }
  }
  return incoming;
}

function classifyStatusFromContext(context) {
  if (/\bcompleted\b|\bdone\b|\bshipped\b|\blanded\b|\bfinished\b|✅|✔|\[x\]/i.test(context)) {
    return 'completed';
  }
  if (/\bblocked\b|\bfailed\b|\berror(?:ed)?\b|\bbroken\b|❌|✗|\[!\]/i.test(context)) {
    return 'failed';
  }
  if (/\bstarting\b|\bworking on\b|\bin progress\b|\bunderway\b|\bbegun\b|⏳|🟡|\[~\]|\[\/\]/i.test(context)) {
    return 'in_progress';
  }
  return null;
}

function applyStatusFromText(plan, assistantText) {
  if (!plan || !assistantText) return plan;
  const lines = String(assistantText).split('\n');
  for (const phase of plan.phases) {
    for (const task of phase.tasks) {
      const needle = task.text.toLowerCase();
      let matchedLine = null;
      let suffix = '';
      for (const rawLine of lines) {
        const line = rawLine.toLowerCase();
        const idx = line.indexOf(needle);
        if (idx < 0) continue;
        matchedLine = rawLine;
        suffix = rawLine.slice(idx + task.text.length);
        break;
      }
      if (!matchedLine) continue;
      const classification = classifyStatusFromContext(suffix) || classifyStatusFromContext(matchedLine);
      if (!classification) continue;
      if (classification === 'in_progress' && task.status !== 'pending') continue;
      task.status = classification;
    }
  }
  return plan;
}

module.exports = {
  PlanExtractError,
  parsePlanMarkdown,
  mergeTaskStatuses,
  applyStatusFromText,
  stableId,
  slugify
};
