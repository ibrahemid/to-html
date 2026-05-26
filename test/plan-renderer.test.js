'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

process.env.XDG_CACHE_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-to-html-planr-'));

const { renderPlan, MAX_PLAN_MARKDOWN_BYTES } = require('../bin/plan-renderer');

const PLAN_MD = `# Build the Feature

## Phase 1: Setup

- [ ] Initialize repository
- [ ] Configure CI

## Phase 2: Implementation

- [x] Write core logic
- [ ] Add error handling
`;

test('renderPlan: returns ok=true with expected shape', async () => {
  const r = await renderPlan({
    markdown: PLAN_MD,
    sessionId: 'test-session',
    cwd: os.tmpdir(),
    project: 'test-project',
    autoOpen: false,
    source: 'test'
  });
  assert.equal(r.ok, true);
  assert.ok(typeof r.planId === 'string');
  assert.ok(typeof r.title === 'string');
  assert.ok(typeof r.path === 'string');
  assert.ok(typeof r.url === 'string');
  assert.ok(typeof r.tasks === 'number');
  assert.ok(typeof r.completed === 'number');
});

test('renderPlan: writes HTML file to disk', async () => {
  const r = await renderPlan({
    markdown: PLAN_MD,
    sessionId: 'test-session-2',
    cwd: os.tmpdir(),
    project: 'test-project',
    autoOpen: false,
    source: 'test'
  });
  assert.ok(fs.existsSync(r.path), 'artifact file must exist');
  const html = fs.readFileSync(r.path, 'utf8');
  assert.ok(html.startsWith('<!doctype html>') || html.startsWith('<!DOCTYPE html>'), 'HTML doctype present');
  assert.ok(html.includes('</html>'), 'closing html tag present');
});

test('renderPlan: HTML contains task class markup', async () => {
  const r = await renderPlan({
    markdown: PLAN_MD,
    sessionId: 'test-session-3',
    cwd: os.tmpdir(),
    project: 'test-project',
    autoOpen: false,
    source: 'test'
  });
  const html = fs.readFileSync(r.path, 'utf8');
  assert.ok(html.includes('class="task'), 'task class markup present in HTML');
});

test('renderPlan: HTML contains phase title', async () => {
  const r = await renderPlan({
    markdown: PLAN_MD,
    sessionId: 'test-session-4',
    cwd: os.tmpdir(),
    project: 'test-project',
    autoOpen: false,
    source: 'test'
  });
  const html = fs.readFileSync(r.path, 'utf8');
  assert.ok(html.includes('Setup'), 'phase title present in HTML');
});

test('renderPlan: task counts are correct', async () => {
  const r = await renderPlan({
    markdown: PLAN_MD,
    sessionId: 'test-session-5',
    cwd: os.tmpdir(),
    project: 'test-project',
    autoOpen: false,
    source: 'test'
  });
  assert.equal(r.tasks, 4);
  assert.equal(r.completed, 1);
});

test('renderPlan: title matches plan heading', async () => {
  const r = await renderPlan({
    markdown: PLAN_MD,
    sessionId: 'test-session-6',
    cwd: os.tmpdir(),
    project: 'test-project',
    autoOpen: false,
    source: 'test'
  });
  assert.equal(r.title, 'Build the Feature');
});

test('renderPlan: titleOverride is reflected in title', async () => {
  const r = await renderPlan({
    markdown: PLAN_MD,
    sessionId: 'test-session-7',
    cwd: os.tmpdir(),
    project: 'test-project',
    autoOpen: false,
    source: 'test',
    titleOverride: 'My Custom Title'
  });
  assert.equal(r.title, 'My Custom Title');
});

test('renderPlan: rerender with same planId sets rerendered=true', async () => {
  const cwd = os.tmpdir();
  const first = await renderPlan({
    markdown: PLAN_MD,
    sessionId: 'test-rerender',
    cwd,
    project: 'test-project',
    autoOpen: false,
    source: 'test'
  });
  assert.equal(first.rerendered, false);

  const second = await renderPlan({
    markdown: PLAN_MD,
    sessionId: 'test-rerender',
    cwd,
    project: 'test-project',
    autoOpen: false,
    source: 'test'
  });
  assert.equal(second.rerendered, true);
  assert.equal(second.planId, first.planId);
});

test('renderPlan: throws PlanRenderError on null input', async () => {
  await assert.rejects(
    () => renderPlan(null),
    (err) => {
      assert.equal(err.name, 'PlanRenderError');
      return true;
    }
  );
});

test('renderPlan: throws PlanRenderError on empty markdown', async () => {
  await assert.rejects(
    () => renderPlan({ markdown: '', sessionId: 'x', cwd: os.tmpdir() }),
    (err) => {
      assert.equal(err.name, 'PlanRenderError');
      return true;
    }
  );
});

test('renderPlan: throws PlanRenderError on whitespace-only markdown', async () => {
  await assert.rejects(
    () => renderPlan({ markdown: '   \n  ', sessionId: 'x', cwd: os.tmpdir() }),
    (err) => {
      assert.equal(err.name, 'PlanRenderError');
      return true;
    }
  );
});

test('renderPlan: truncates oversized markdown instead of crashing', async () => {
  const big = '## Phase: Giant\n\n' + '- [ ] task\n'.repeat(10) + '\n' + 'x '.repeat(MAX_PLAN_MARKDOWN_BYTES);
  const r = await renderPlan({
    markdown: big,
    sessionId: 'test-big',
    cwd: os.tmpdir(),
    project: 'test-project',
    autoOpen: false,
    source: 'test'
  });
  assert.equal(r.ok, true);
  assert.ok(fs.existsSync(r.path));
  const html = fs.readFileSync(r.path, 'utf8');
  assert.ok(html.includes('truncated'));
});

test('renderPlan: autoOpen=false means opened=false', async () => {
  const r = await renderPlan({
    markdown: PLAN_MD,
    sessionId: 'test-noopen',
    cwd: os.tmpdir(),
    project: 'test-project',
    autoOpen: false,
    source: 'test'
  });
  assert.equal(r.opened, false);
});

test('renderPlan: path ends with .html', async () => {
  const r = await renderPlan({
    markdown: PLAN_MD,
    sessionId: 'test-ext',
    cwd: os.tmpdir(),
    project: 'test-project',
    autoOpen: false,
    source: 'test'
  });
  assert.ok(r.path.endsWith('.html'));
});

test('renderPlan: planId is stable for identical input', async () => {
  const opts = {
    markdown: PLAN_MD,
    sessionId: 'test-stable',
    cwd: os.tmpdir(),
    project: 'test-project',
    autoOpen: false,
    source: 'test'
  };
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-to-html-planr2-'));
  const origCache = process.env.XDG_CACHE_HOME;
  process.env.XDG_CACHE_HOME = tmp2;
  const r1 = await renderPlan(opts);
  const r2 = await renderPlan({ ...opts, sessionId: 'test-stable-2' });
  process.env.XDG_CACHE_HOME = origCache;
  assert.equal(r1.planId, r2.planId);
});
