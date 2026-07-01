#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { assembleArtifact } = require(path.join(__dirname, '..', '..', 'core', 'lib', 'artifact'));

const DEST = path.join(__dirname, '..', 'public', 'examples', 'to-html');

const specs = [
  {
    kind: 'dashboard',
    title: 'to-html: build status',
    subtitle: 'Where the on-demand renderer stands.',
    meta: { project: 'to-html', generatedAt: '2026-07-01', note: 'Snapshot, not live.' },
    sections: [
      {
        title: 'Core',
        summary: 'The deterministic assembler and its kinds.',
        items: [
          { label: 'Spec validation', status: 'done', detail: 'Every kind validates its spec and throws on the first bad field.' },
          { label: 'Seven kinds', status: 'done', detail: 'dashboard, report, options, diagram, checklist, asset-grid, findings.' },
          { label: 'Sanitized markdown', status: 'done', detail: 'Plain text escaped, markdown sanitized, unsafe links dropped.' }
        ]
      },
      {
        title: 'Adapter',
        items: [
          { label: 'Claude Code plugin', status: 'done', detail: 'Skill authors a spec, the CLI assembles and opens the file.' },
          { label: 'Config keys', status: 'in_progress', detail: 'theme, size, width, font, and opener persist per install.' },
          {
            label: 'Opener default',
            status: 'decision',
            detail: 'Should a fresh install open in the system default browser or ask once?',
            copyPrompt: 'Decide the default browser opener for a fresh to-html install.'
          }
        ]
      }
    ]
  },
  {
    kind: 'report',
    title: 'Dependency report',
    subtitle: 'Runtime and dev dependencies at a glance.',
    meta: { project: 'to-html', generatedAt: '2026-07-01' },
    sections: [
      {
        title: 'Runtime',
        summary: 'The core ships with zero runtime dependencies.',
        table: {
          columns: ['Package', 'Used by', 'Version'],
          rows: [['(none)', 'core', 'zero runtime deps']]
        }
      },
      {
        title: 'Toolchain',
        table: {
          columns: ['Tool', 'Purpose', 'Version'],
          rows: [
            ['node', 'runtime', '18+'],
            ['astro', 'this site', '4.x'],
            ['node --test', 'test runner', 'built-in']
          ]
        },
        links: [
          { href: 'https://github.com/ibrahemid/to-html', text: 'Source' },
          { href: 'https://nodejs.org', text: 'Node' }
        ]
      }
    ]
  },
  {
    kind: 'options',
    title: 'Pick a default theme',
    subtitle: 'Which theme a fresh install should open with.',
    options: [
      {
        title: 'auto',
        summary: 'Follow the OS light/dark setting.',
        recommended: true,
        pros: ['No surprise for the viewer', 'Matches the rest of their screen'],
        cons: ['Depends on the browser reporting the setting']
      },
      {
        title: 'light',
        summary: 'Always the paper theme.',
        pros: ['Predictable in screenshots', 'Reads well when printed'],
        cons: ['Harsh at night']
      },
      {
        title: 'dark',
        summary: 'Always the ink theme.',
        pros: ['Easy on the eyes at night'],
        cons: ['Washed out in a bright room']
      }
    ]
  },
  {
    kind: 'diagram',
    title: 'Artifact flow',
    subtitle: 'From a request to an open file.',
    direction: 'LR',
    nodes: [
      { id: 'ask', label: 'You ask' },
      { id: 'spec', label: 'Model builds spec' },
      { id: 'validate', label: 'Core validates' },
      { id: 'assemble', label: 'Assemble one file' },
      { id: 'open', label: 'Open in browser' }
    ],
    edges: [
      { from: 'ask', to: 'spec', label: 'natural language' },
      { from: 'spec', to: 'validate', label: 'JSON spec' },
      { from: 'validate', to: 'assemble', label: 'ok' },
      { from: 'validate', to: 'spec', label: 'bad field' },
      { from: 'assemble', to: 'open' }
    ]
  },
  {
    kind: 'checklist',
    title: 'Ship checklist',
    subtitle: 'Checked state is saved in your browser only.',
    groups: [
      {
        title: 'Before publish',
        summary: 'Run these once before tagging a release.',
        items: [
          { text: 'Tests pass', detail: 'node --test across every workspace.' },
          { text: 'Lint clean', detail: 'Zero warnings.' },
          { text: 'Synced adapter copies match source' }
        ]
      },
      {
        title: 'After publish',
        items: [
          { text: 'Marketplace entry installs', detail: '/plugin marketplace add ibrahemid/to-html' },
          { text: 'CHANGELOG updated', links: [{ href: 'https://github.com/ibrahemid/to-html/blob/main/adapters/claude-code/CHANGELOG.md', text: 'CHANGELOG' }] }
        ]
      }
    ]
  },
  {
    kind: 'asset-grid',
    title: 'Export bundle',
    subtitle: 'Files ready to hand off.',
    assets: [
      {
        name: 'Logo (SVG)',
        caption: 'Vector mark, scales to any size.',
        downloads: [{ href: 'https://github.com/ibrahemid/to-html', text: 'Download SVG' }]
      },
      {
        name: 'Logo (PNG)',
        caption: '1024px, transparent background.',
        downloads: [{ href: 'https://github.com/ibrahemid/to-html', text: 'Download PNG' }]
      },
      {
        name: 'Readme',
        caption: 'Install and usage.',
        downloads: [{ href: 'https://github.com/ibrahemid/to-html#readme', text: 'Open README' }]
      }
    ]
  },
  {
    kind: 'findings',
    title: 'Input audit',
    subtitle: 'What the sanitizer catches in a spec.',
    meta: { project: 'to-html', generatedAt: '2026-07-01' },
    groups: [
      {
        title: 'Links and images',
        findings: [
          {
            title: 'javascript: link dropped',
            severity: 'high',
            category: 'links',
            description: 'A link whose href is not http(s) or a safe scheme is removed before render.'
          },
          {
            title: 'Relative asset href dropped',
            severity: 'medium',
            category: 'links',
            description: 'Downloads and links must be absolute http(s); relative paths are dropped so the file stays self-contained.'
          }
        ]
      },
      {
        title: 'Markdown',
        findings: [
          {
            title: 'Raw HTML in markdown escaped',
            severity: 'high',
            category: 'markdown',
            description: 'Markdown fields are sanitized; injected tags render as text, not markup.'
          },
          {
            title: 'Plain-text fields escaped',
            severity: 'info',
            category: 'text',
            description: 'Titles, labels, and table cells are HTML-escaped.'
          }
        ]
      }
    ]
  }
];

function main() {
  fs.mkdirSync(DEST, { recursive: true });
  for (const spec of specs) {
    const { html, kind } = assembleArtifact(spec);
    const out = path.join(DEST, kind + '.html');
    fs.writeFileSync(out, html);
    console.log('OK ' + kind + ' -> ' + path.relative(process.cwd(), out) + ' (' + html.length + ' bytes)');
  }
}

main();
