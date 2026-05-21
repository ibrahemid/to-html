# to-html

HTML rendering mode for Claude Code. Toggle with `/to-html` and every assistant response gets written to a self-contained HTML file alongside the regular terminal output. Native plan-mode integration renders a live dashboard for `ExitPlanMode` plans.

## Install

```
/plugin marketplace add ibrahemid/plugins
/plugin install to-html@ibrahemid
```

## Commands

```
/to-html              toggle HTML mode for this project
/to-html on|off       explicit set
/to-html status       show current mode
/to-html reset        clear mode + auto-open preference
/to-html plan <path>  render a markdown plan file
/to-html plan status  show active plan
/to-html plan reset   clear active plan
/html                 alias of /to-html
```

First `/to-html on` asks once whether to auto-open generated files in your default browser. Answer persists for the project.

## Output

Files are written outside the project:

```
~/Library/Caches/cc-to-html/artifacts/<session-id>/   (macOS)
~/.cache/cc-to-html/artifacts/<session-id>/           (Linux)
%LOCALAPPDATA%\cc-to-html\Cache\artifacts\<session-id>\   (Windows)
```

Per-turn responses save as `NNNN-<slug>.html`. Plans save as `plan-<slug>.html` (stable filename, auto-reloads every 3 seconds).

## Plan mode

When HTML mode is on and Claude calls `ExitPlanMode`, the plugin renders the plan with a phase sidebar, status badges (◯ pending · ◐ in-progress · ● done · ✕ failed), progress bars, and a `Copy as markdown` export. As Claude executes the plan, the Stop hook diffs each reply against the task list and flips statuses live.

Status heuristic (line-scoped):

| Assistant text | Resulting status |
|---|---|
| `Inventory schemas: completed ✅` | done |
| `Move auth: blocked, waiting on legal` | failed |
| `List blockers: now working on this` | in-progress |

## Interactive controls

Ask for a slider, dropdown, choice, or kanban and Claude emits a fenced ` ```html-spec ` JSON block in its response. The block is stripped from the terminal output and rendered as controls in the HTML. `Copy as prompt` collects the control state and copies it back as a structured prompt. See `skills/to-html-schema/SKILL.md` for the schema.

## Architecture

```
/to-html        -> bin/cli.js writes per-project state
Stop hook       -> bin/stop-hook.js reads transcript, renders per-turn HTML
                   and (if activePlan is set) re-renders the plan file with
                   status diff against the latest assistant turn
PostToolUse     -> bin/post-tool-hook.js matches ExitPlanMode and renders
                   the plan via bin/plan-renderer.js
```

All HTML is produced by a deterministic Node renderer (Claude never authors HTML). Markdown parsing is the vendored `marked` (v13.0.3, MIT) under `vendor/`. Output sanitization uses a strict tag/attribute allowlist.

## Security

- CSP meta tag: `default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`.
- Link `href` and image `src` checked against `https:`, `http:`, `mailto:`, `#`, `/`, `data:image/*`. Everything else is dropped.
- All `on*` event-handler attributes stripped.
- HTML comments stripped.
- Anchor tags get `rel="noopener noreferrer"`.
- Generated files never re-enter Claude's context. Round-trip happens through the user's clipboard.

## Requirements

- Node.js 18+
- No npm install needed (`marked` is vendored).

## Smoke test

```
echo '{"markdown":"# Hello\n\nWorld.","sessionId":"smoke","turnIndex":1}' \
  | node bin/render.js
```

## License

MIT
