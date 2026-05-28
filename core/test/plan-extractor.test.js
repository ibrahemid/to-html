'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parsePlanMarkdown,
  mergeTaskStatuses,
  applyStatusFromText,
  classifyStatusFromContext,
  MIN_TASK_TEXT_LEN
} = require('../lib/plan-extractor');

test('parsePlanMarkdown: throws on empty input', () => {
  assert.throws(() => parsePlanMarkdown(''));
  assert.throws(() => parsePlanMarkdown('   '));
});

test('parsePlanMarkdown: parses phases and checkbox tasks', () => {
  const plan = parsePlanMarkdown(`# Migration\n\n## Phase 1: Audit\n\n- [ ] Inventory\n- [x] Setup\n\n## Phase 2: Migrate\n\n- [ ] Run dump`);
  assert.equal(plan.title, 'Migration');
  assert.equal(plan.phases.length, 2);
  assert.equal(plan.phases[0].tasks.length, 2);
  assert.equal(plan.phases[0].tasks[1].status, 'completed');
});

test('parsePlanMarkdown: ignores tasks inside code fences', () => {
  const plan = parsePlanMarkdown(`# T\n\n## Phase 1\n\n\`\`\`\n- this is inside a fence\n1. so is this\n\`\`\`\n\n- [ ] real task`);
  assert.equal(plan.phases[0].tasks.length, 1);
  assert.equal(plan.phases[0].tasks[0].text, 'real task');
});

test('parsePlanMarkdown: deduplicates phase ids on duplicate titles', () => {
  const plan = parsePlanMarkdown(`# T\n\n## Phase 1\n\n- [ ] a\n\n## Phase 1\n\n- [ ] b`);
  assert.equal(plan.phases.length, 2);
  assert.notEqual(plan.phases[0].id, plan.phases[1].id);
});

test('parsePlanMarkdown: deduplicates task ids on duplicate text within a phase', () => {
  const plan = parsePlanMarkdown(`# T\n\n## P\n\n- [ ] dup\n- [ ] dup`);
  assert.equal(plan.phases[0].tasks.length, 2);
  assert.notEqual(plan.phases[0].tasks[0].id, plan.phases[0].tasks[1].id);
});

test('parsePlanMarkdown: rejects too-short task text', () => {
  const plan = parsePlanMarkdown(`# T\n\n## P\n\n- a\n- bb\n- valid task`);
  assert.equal(plan.phases[0].tasks.length, 1);
  assert.equal(plan.phases[0].tasks[0].text, 'valid task');
});

test('parsePlanMarkdown: flat task list with no phases makes a single "Plan" phase', () => {
  const plan = parsePlanMarkdown(`- [ ] alpha task\n- [ ] beta task`);
  assert.equal(plan.phases.length, 1);
  assert.equal(plan.phases[0].title, 'Plan');
  assert.equal(plan.phases[0].tasks.length, 2);
});

test('classifyStatusFromContext: detects all four states', () => {
  assert.equal(classifyStatusFromContext('completed today ✅'), 'completed');
  assert.equal(classifyStatusFromContext('blocked on legal'), 'failed');
  assert.equal(classifyStatusFromContext('now working on it'), 'in_progress');
  assert.equal(classifyStatusFromContext('plain text'), null);
});

test('applyStatusFromText: line-scoped, no cross-task bleed', () => {
  const plan = parsePlanMarkdown(`# T\n\n## P\n\n- [ ] Inventory schemas\n- [ ] List blockers\n- [ ] Move auth`);
  applyStatusFromText(plan, [
    'Inventory schemas: completed ✅',
    'List blockers: working on this in progress',
    'Move auth: blocked by legal'
  ].join('\n'));
  const [a, b, c] = plan.phases[0].tasks;
  assert.equal(a.status, 'completed');
  assert.equal(b.status, 'in_progress');
  assert.equal(c.status, 'failed');
});

test('applyStatusFromText: tasks too short are skipped', () => {
  const plan = {
    phases: [{
      tasks: [
        { id: 't1', text: 'ok', status: 'pending' },
        { id: 't2', text: 'longer task', status: 'pending' }
      ]
    }]
  };
  applyStatusFromText(plan, 'longer task: done');
  assert.equal(plan.phases[0].tasks[0].status, 'pending');
  assert.equal(plan.phases[0].tasks[1].status, 'completed');
});

test('applyStatusFromText: null-safe with malformed plan', () => {
  assert.doesNotThrow(() => applyStatusFromText(null, 'x'));
  assert.doesNotThrow(() => applyStatusFromText({ phases: null }, 'x'));
  assert.doesNotThrow(() => applyStatusFromText({ phases: [{ tasks: null }] }, 'x'));
});

test('mergeTaskStatuses: prior non-pending status wins', () => {
  const existing = {
    phases: [{ tasks: [{ id: 't1', text: 'x', status: 'completed' }] }]
  };
  const incoming = {
    phases: [{ tasks: [{ id: 't1', text: 'x', status: 'pending' }] }]
  };
  mergeTaskStatuses(existing, incoming);
  assert.equal(incoming.phases[0].tasks[0].status, 'completed');
});

test('MIN_TASK_TEXT_LEN exported', () => {
  assert.ok(MIN_TASK_TEXT_LEN >= 3);
});

test('parsePlanMarkdown: nowIso option overrides createdAt for deterministic output', () => {
  const { parsePlanMarkdown } = require('../lib/plan-extractor');
  const md = '# Plan\n## Phase\n- [ ] task one';
  const fixed = '2026-05-28T00:00:00.000Z';
  const plan = parsePlanMarkdown(md, { nowIso: fixed });
  assert.strictEqual(plan.createdAt, fixed);
});

test('parsePlanMarkdown: default createdAt is current wall clock when nowIso omitted', () => {
  const { parsePlanMarkdown } = require('../lib/plan-extractor');
  const before = new Date().toISOString();
  const plan = parsePlanMarkdown('# P\n## X\n- [ ] t');
  const after = new Date().toISOString();
  assert.ok(plan.createdAt >= before && plan.createdAt <= after);
});
