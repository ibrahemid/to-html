# to-html

Content-aware HTML rendering for Claude Code. `/to-html` flips it on; every substantive reply is classified and rendered in the template that fits the content. Trivial replies are skipped.

## Install

```
/plugin marketplace add ibrahemid/plugins
/plugin install to-html@ibrahemid
```

## Use

```
/to-html
```

First call enables HTML mode and asks once whether to auto-open generated files. Second call disables. State and preference persist per project.

## Templates

The Stop hook classifies each assistant reply and picks one:

| Signal in the reply | Template |
|---|---|
| `## Phase N:` headings or `[ ]` task lists | `plan` — phase sidebar, status badges, live reload |
| `## Option A/B/C` or `## Approach 1/2/3` | `comparison` — side-by-side cards with pros / cons / effort |
| `TL;DR:` line + multi-section structure | `explainer` — TL;DR pill, sticky TOC, prose body |
| Anything else with structure | `prose` — minimal editorial typography |
| Under 240 chars, no structure | *skipped — no artifact* |

`ExitPlanMode` always renders the `plan` template directly, with a 3-second auto-reload. As Claude executes the plan, the Stop hook diffs each subsequent reply against the task list and flips statuses live.

## Output

```
~/Library/Caches/cc-to-html/artifacts/<session-id>/   (macOS)
~/.cache/cc-to-html/artifacts/<session-id>/           (Linux)
%LOCALAPPDATA%\cc-to-html\Cache\artifacts\<session-id>\   (Windows)
```

Filenames: `NNNN-<template>-<slug>.html` for per-turn artifacts, `plan-<slug>.html` for plans.

Outside your project. Never written into the repo.

## Override (advanced)

Prepend a fenced block to a reply to force a template:

```` 
```to-html
{"template":"comparison","title":"Three approaches"}
```
````

The block is stripped before rendering. Unknown templates fall back to the classifier.

## Security

- CSP: `default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src 'unsafe-inline'`. No network, no remote assets, no forms.
- Tag/attribute allowlist sanitizer. All `on*` handlers stripped.
- Link `href` / image `src` validated against safe URL pattern.
- Claude never writes raw HTML. Markdown is parsed by vendored `marked`; templates render from structured data.

## Requirements

Node.js 18+. No npm install. `marked` is vendored under `vendor/`.

## License

MIT
