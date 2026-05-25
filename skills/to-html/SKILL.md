---
name: to-html
description: Toggle HTML rendering mode for the conversation. When on, substantive assistant replies render to a self-contained HTML artifact and the file path is printed inline. Use when the user types /to-html, /html, "turn on html mode", "render this as html", "open this in browser", or wants to read agent output visually. If the user types /to-html diag, /to-html debug, /to-html status, /to-html doctor, or asks "why isn't to-html working", run the diagnostic flow. If the user types /to-html config ..., run the config flow.
---

The user invoked `/to-html`. Inspect their exact text and pick a flow:

- contains `diag`, `debug`, `doctor`, or `status` → **diagnostic flow**
- starts with `config` (e.g. `/to-html config auto-open yes`) → **config flow**
- otherwise → **toggle flow**

## Authoring contract (when mode is on)

When `/to-html` mode is on, lead substantial replies with `**TL;DR:** <one or two sentences>`. When the answer has parts that relate (flow, dependencies, comparison, dataflow), include a fenced ` ```mermaid ` block (`graph TD` or `graph LR`) whose node labels echo your section headings. The renderer hoists the TL;DR into a band and renders the mermaid as an interactive map cross-linked to the body. Trivial replies (under ~600 chars with no structure) render nothing.

## Toggle flow

Run one Bash call:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/cli.js" toggle
```

Print the `message` field from the JSON response as a single line. Nothing else.

When mode is on, the Stop hook renders the most recent substantive reply (skipping its own toggle status and the auto-open question). A PostToolUse hook on `ExitPlanMode` renders plans as a live dashboard. Toggling off silences both hooks. Auto-open is off by default; the user can enable it with `/to-html config auto-open yes`.

## Config flow

Pass the user's arguments through to the cli. Examples:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/cli.js" config auto-open yes
node "${CLAUDE_PLUGIN_ROOT}/bin/cli.js" config theme dark
node "${CLAUDE_PLUGIN_ROOT}/bin/cli.js" config size l
node "${CLAUDE_PLUGIN_ROOT}/bin/cli.js" config width comfortable
node "${CLAUDE_PLUGIN_ROOT}/bin/cli.js" config font sans
node "${CLAUDE_PLUGIN_ROOT}/bin/cli.js" config show
```

Valid keys and values:

- `auto-open` — `yes` | `no`
- `theme` — `auto` | `light` | `dark` | `sepia`
- `size` — `s` | `m` | `l` | `xl`
- `width` — `narrow` | `comfortable` | `wide`
- `font` — `sans` | `serif`

Print the `message` field. If the cli returned `ok: false`, print the `error` field as the one line.

## Diagnostic flow

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/diagnose.js"
```

Print the output verbatim.

If `recent hook events` is `(none yet)`:

> The Stop hook hasn't fired since this CC session started. Run `/reload-plugins`. If that doesn't help, restart Claude Code. After that, ask any question, then run `/to-html diag` again to confirm.

If hook events exist but all show `mode=off`: HTML mode is OFF. Run `/to-html` to enable.

If events show errors, surface the most recent error and stop.
