<h1 align="center">to-html</h1>

<p align="center">HTML rendering mode for Claude Code. Type <code>/to-html</code> and every substantive reply opens in your browser.</p>

<p align="center">
  <a href="https://ibrahemid.github.io/plugins/to-html/">Live gallery</a> ·
  <a href="#install">Install</a> ·
  <a href="#templates">Templates</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="./CHANGELOG.md">Changelog</a>
</p>

<p align="center">
  <a href="https://ibrahemid.github.io/plugins/examples/to-html/plan.html">
    <img src="./docs/screenshots/thumb-plan.png" alt="to-html plan template — phase sidebar with status badges and focus checkboxes" width="900">
  </a>
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

The Stop hook classifies each reply and picks one. Click any thumbnail for the live, interactive artifact.

<table>
  <tr>
    <td align="center" width="50%">
      <a href="https://ibrahemid.github.io/plugins/examples/to-html/prose.html">
        <img src="./docs/screenshots/thumb-prose.png" alt="prose template" width="420">
      </a>
      <br><sub><b>prose</b> — editorial typography for anything substantive without special structure</sub>
    </td>
    <td align="center" width="50%">
      <a href="https://ibrahemid.github.io/plugins/examples/to-html/plan.html">
        <img src="./docs/screenshots/thumb-plan.png" alt="plan template" width="420">
      </a>
      <br><sub><b>plan</b> — phase sidebar, live status badges, per-task focus checkboxes</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <a href="https://ibrahemid.github.io/plugins/examples/to-html/comparison.html">
        <img src="./docs/screenshots/thumb-comparison.png" alt="comparison template" width="420">
      </a>
      <br><sub><b>comparison</b> — side-by-side options, pros/cons, pick + reason</sub>
    </td>
    <td align="center">
      <a href="https://ibrahemid.github.io/plugins/examples/to-html/explainer.html">
        <img src="./docs/screenshots/thumb-explainer.png" alt="explainer template" width="420">
      </a>
      <br><sub><b>explainer</b> — TL;DR pill, sticky TOC, reading column</sub>
    </td>
  </tr>
</table>

Trivial replies (one-liners, status echoes — under 240 chars with no structure) skip rendering. No artifact, clean terminal.

| Triggers on | Template |
|---|---|
| `## Phase N:` headings or 3+ `[ ]` tasks | `plan` |
| 2+ `## Option / Approach / Variant` headings | `comparison` |
| `TL;DR:` keyword or multi-section structure | `explainer` |
| Anything else with structure | `prose` |
| Under 240 chars, no structure | `skip` |

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
