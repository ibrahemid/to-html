<h1 align="center">to-html</h1>

<p align="center">HTML rendering mode for Claude Code. Type <code>/to-html</code> and every substantive reply opens in your browser.</p>

<p align="center">
  <a href="https://ibrahemid.github.io/plugins/to-html/">Live gallery</a> ·
  <a href="#install">Install</a> ·
  <a href="#templates">Templates</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="./CHANGELOG.md">Changelog</a>
</p>

## Install

```
/plugin marketplace add ibrahemid/plugins
/plugin install to-html@ibrahemid
```

## Use

```
/to-html       toggle mode (state persists per project)
/to-html diag  diagnostics if the hook seems silent
```

First enable asks once whether to auto-open. Answer persists.

## Templates

The Stop hook classifies each reply and picks one. Trivial replies (one-liners, status echoes) skip rendering — no artifact, clean terminal.

| Template | Triggers on | What it gives you |
|---|---|---|
| `plan` | `## Phase N:` headings or 3+ `[ ]` tasks | Phase sidebar, status badges (◯ ◐ ● ✕), progress bar, focus checkboxes on each task, copy-as-prompt with your selections |
| `comparison` | 2+ `## Option / Approach / Variant` headings | Side-by-side cards with pros/cons/effort, click to pick, one-line reason field, copy-as-prompt with your choice |
| `explainer` | `TL;DR:` keyword or multi-section structure | TL;DR pill, sticky table of contents, prose body in a comfortable column |
| `prose` | Anything substantive without the above structure | Minimal editorial typography. No chrome, no fluff. |
| `skip` | < 240 chars, no headings, no code, no tables | No artifact. Terminal stays clean. |

Override the classifier from any reply by prepending a fenced block:

````
```to-html
{"template":"comparison","title":"Three approaches"}
```
````

## How it works

A `Stop` hook reads the assistant's reply, runs a deterministic classifier (no LLM tokens spent on classification or rendering), dispatches to the chosen template, and writes a self-contained HTML file outside your project. A second hook on `ExitPlanMode` always renders the plan as a live dashboard that auto-reloads as tasks progress.

```
~/Library/Caches/cc-to-html/artifacts/<session>/   (macOS)
~/.cache/cc-to-html/artifacts/<session>/           (Linux)
%LOCALAPPDATA%\cc-to-html\Cache\artifacts\         (Windows)
```

Decision-bar buttons (Copy as prompt) only emit what you selected in the artifact, never the full input. The assistant already has the input in context.

## Diagnostics

If the hook seems silent after install:

```
/to-html diag
```

Prints current state, recent hook events, and tells you whether the hook is firing. Most common fix after install or update: `/reload-plugins`, or a full Claude Code restart.

## Security

- CSP: `default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src 'unsafe-inline'`. No network, no remote assets, no forms.
- Tag/attribute allowlist sanitizer. All `on*` handlers stripped.
- Link `href` / image `src` validated against `https:`, `http:`, `mailto:`, `#`, `/`, `data:image/*`.
- Claude never writes raw HTML. Markdown is parsed by vendored `marked@13.0.3` (MIT) and rendered through structured templates.

## Requirements

Node 18+. No npm install. 64 tests via `npm test`.

## License

MIT.
