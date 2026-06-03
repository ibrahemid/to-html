# Changelog

## v2.1.3

### Fixed
- Concept-map node labels stopped showing literal `<br/>` text. The diagram parser now strips `<br>`, `<br/>`, and any other HTML tags from node and edge labels before render.
- Concept-map edge labels stopped colliding into illegible strings when multiple edges had similar midpoints. Labels are now staggered along the path.

### Changed
- Tightened the enrichment prompt: no HTML in labels, prefer 3-6 nodes, prefer arrows WITHOUT labels, return empty mermaid when the reply has no structure worth visualizing.

## v2.1.2

### Fixed
- Live session preview stayed blank after upgrading from v2.0.3 because ensurePreviewHtml was idempotent: the stale shell file (with the old CSP that blocked external script loads) was never replaced on the next Stop hook. ensurePreviewHtml now reconciles the on-disk shell to the current bytes; identical contents are still a no-op (no churn).

## v2.1.1

### Fixed
- Live session preview was blank in Chrome because the embedded CSP allowed only inline scripts; the poller dynamically injects external script tags to load per-turn chunks, so all loads were blocked. The preview-shell CSP now permits same-scheme script loads (`script-src 'unsafe-inline' file:`). Stale frame-ancestors directive (no-op in <meta>) removed.
- README, CLI bin, and CLI package description no longer reference internal phasing.

## v2.1.0

### Changed
- Extracted the renderer into a shared core in `ibrahemid/to-html`; the plugin is installed via git-subdir from that repo. No end-user behavior change: output is byte-identical for the same input.
- The plugin no longer injects a TL;DR + mermaid authoring contract into the conversation. The model writes naturally; to-html derives the summary and concept map after the fact via a detached, fail-safe enrichment call (configurable: /to-html config enrich on|off, enrich-model <id>).
- auto-open now opens a live per-session preview that shows a timeline of turns and updates in place. Per-turn archive files are unchanged.

## v2.0.3

### Fixed
- **Concept-map click-to-section restored.** Clicking a map node had stopped scrolling to its section and opening the detail panel: the section anchor ids were injected as raw HTML that the renderer stripped, so the targets never existed in the page. Heading ids are now applied to the rendered headings directly, and the detail panel reads the matching section.
- **Security: ReDoS in the ```to-html override fence.** A reply or transcript line with many newlines and no closing fence could make classification backtrack for minutes and stall the Stop hook. The fence pattern is now linear, and an oversized transcript is capped so it can't exhaust memory.
- **`flowchart TD/LR`** (Mermaid v9+ keyword) now renders instead of producing stray nodes.
- **`TL;DR` inside code blocks** no longer changes the layout or gets hoisted out of the body.
- **Cyclic graphs** lay out without parking downstream nodes at the top; a pure cycle is still left unrendered.
- **Mixed code fences** (```` ``` ```` vs `~~~`) are tracked by delimiter, so a nested fence no longer drops heading anchors or salvages a graph from inside a code block.
- **Windows `file://` links** keep the drive-letter colon and handle UNC paths.

### Accessibility
- Concept-map nodes are reachable by screen readers (removed the `role="img"` that hid them) and show a visible keyboard focus ring.
- Focus moves into the settings and detail panels on open and returns on close; Escape closes them; Tab is trapped within the settings panel.
- Reading-order and zoom keyboard shortcuts no longer intercept screen-reader or browser navigation.
- Added a `<main>` landmark, labelled the plan and comparison controls, and removed duplicate landmark labels.
- Body, status, and muted text meet WCAG AA contrast across light, dark, and sepia themes; animations respect `prefers-reduced-motion`.

## v2.0.2

### Fixed
- **Unfenced `graph TD/LR` blocks now render as the concept map instead of printing as raw text.** The map only ever resolved from a fenced ```` ```mermaid ```` block; a bare graph fell through to prose and showed its source. The renderer now salvages an unfenced graph (scan for the `graph` header, collect the contiguous statement lines, accept only if it forms a meaningful shape), lifts it into the map, and strips the source from the body. Salvage runs only when no fenced block is present and is gated by the same meaningful-shape check, so prose that merely mentions a graph is unaffected.

## v2.0.1

### Fixed
- **Dropped the reply after the one you toggled on.** The Stop hook fires before Claude Code flushes the new reply to the transcript. If a *previous* reply was already long enough, the hook read it, saw it matched the last-rendered hash, and skipped, so the next reply never got its own artifact. The hook now treats an already-rendered candidate as not-yet-flushed and retries (up to 3 times) until a fresh substantive reply lands.

### Changed
- The copied prompt no longer appends unrequested directives ("Proceed with implementation…", "Skip the rest for now."). It emits only your selection.
- Trimmed chatty in-artifact microcopy and the prose kicker / reading-time line.

## v2.0.0

### Added
- **TL;DR band** at the top of every artifact when the reply opens with `**TL;DR:** …` (or `## TL;DR`). Hoisted out of the body, never synthesized.
- **Concept map** rendered from a ```` ```mermaid ```` block. Interactive: hover to trace edges, click a node to scroll to its matching section and open a detail panel, drag to pan, scroll or `+`/`-`/`0` to zoom. When no mermaid block exists, a sticky **TOC rail** replaces the map.
- **Reading-order stepper** at the bottom: `‹ N / total · current heading ›`. Keyboard: `j`/`k` or `←`/`→`.
- **In-page search/filter** over section headings and graph nodes. `/` to focus.
- **Settings gear** (top-right): theme (auto/light/dark/sepia), text size (S/M/L/XL), width (narrow/comfortable/wide), font (sans/serif), and toggles to hide TL;DR / map / stepper. CSS-variable driven, per-page state in `sessionStorage`, durable defaults via `/to-html config`.
- **`UserPromptSubmit` hook** (`bin/prompt-hook.js`): while mode is on, injects a reminder so the model leads substantial replies with a `**TL;DR:**` line and emits a `mermaid` block when content has related parts.
- **`/to-html config <key> <value>`** for `auto-open`, `theme`, `size`, `width`, `font`. Persists in state and is baked into every artifact's `:root` data-attributes.

### Changed
- **Render gate** (`shouldRender`) distinct from `shouldSkip`. Default thresholds: 600+ prose chars, OR 2+ headings, OR a code block, OR a table (≥3 rows), OR 3+ checkboxes, OR an explicit mermaid/`to-html` block. Manual `/to-html` toggle bypasses the gate so the response you were already looking at always renders.
- **Auto-open default is `false`.** The skill no longer asks the auto-open question. Enable it with `/to-html config auto-open yes`.
- **Reading-first typography.** Defaults: 18px, line-height ~1.62, 66ch measure. Dropped the prose template's drop cap, roman-numeral section counters, all-small-caps first lines, paragraph indents, and end-mark.
- **`buildShell` slots** (`tldrHtml`, `mapHtml`, `chromeHtml`, `uiDefaults`). TL;DR + map + chrome are resolved once in `bin/render.js` and emitted by the shell, not by individual templates. Templates render their body accent only.
- **`renderSvg` extracted** to `lib/svg-graph.js` so the diagram template and the universal map share one renderer.
- **State schema v4.** New fields: `autoOpen` (boolean, default `false`), `uiDefaults`, `renderThreshold`, `modeChangedAt`. v3 files migrate automatically; the v3 `activePlan` reset still runs.

### Files
- New: `lib/summary.js`, `lib/section-index.js`, `lib/graph-source.js`, `lib/svg-graph.js`, `lib/templates/parts.js`, `bin/prompt-hook.js`, `assets/map.css`, `assets/map-runtime.js`, `assets/chrome.css`, `assets/chrome-runtime.js`.
- Tests: `summary.test.js`, `section-index.test.js`, `graph-source.test.js`, `prompt-hook.test.js`. 102 tests total.

## v1.1.1

### Fixed
- **Rendered the wrong turn.** Toggling `/to-html` on mid-conversation rendered the toggle's own status reply (`HTML mode: ON · auto-open: yes …`) instead of the substantive response you were looking at. The Stop hook now strips plugin-control lines (`HTML mode:`, the auto-open question, `[to-html …]` echoes) and walks back up to 12 turns to render the **most recent substantive** assistant message. Toggling on now renders what was on screen when you toggled.
- **Plain-text auto-open prompt.** The skill now asks the auto-open question through the native `AskUserQuestion` UI instead of a `(yes/no)` text line.

### Note
The retry-on-short-read logic from v1.0.2 still applies - it now retries the substantive-target resolution, so a mid-flush transcript no longer yields a stale or empty render. 72 tests (was 64); 8 new cover control-stripping and last-substantive selection, verified against the real transcript that exposed the bug.

## v1.1.0

### Added
- **`diagram` template.** When a reply contains a fenced ` ```mermaid ` block with `graph TD/LR` syntax, the Stop hook parses it (`lib/diagram-parser.js`), computes a topological layout (`lib/diagram-layout.js`), and renders pure SVG. Hover a node to dim the rest and trace its incoming and outgoing edges. Click to lock the focus; click outside to clear. No mermaid runtime - the diagram ships as plain SVG inside the artifact, fits the existing CSP.
- **Prose template** with serif body, drop cap, roman-numeral section markers, and a reading-time estimate. (Removed in v2.0.0.)
- Six templates total (was four user-visible): `diagram`, `plan`, `comparison`, `explainer`, `prose`, `skip`.

### Gallery
- Editorial redesign (Crimson Pro + JetBrains Mono, warm paper/ochre palette).
- Specimen sheet for to-html with one section per template, real screenshots, "Open live" affordance.
- Live at https://ibrahemid.github.io/plugins/.

## v1.0.2

### Fixed
- **Stop hook reading stale transcript.** CC writes the assistant's final text block to the transcript JSONL *after* firing the `Stop` hook. The hook was reading the file before the final block landed, seeing only the short preface text (or no text), and classifying the whole turn as `trivial` / `skip`. The big response that followed got no artifact. Now: on first read, if the text is under 400 chars, the hook sleeps 600 ms and re-reads once. Stable text drives the render.
- **Duplicate renders on multi-fire turns.** Each `Stop` event now hashes the latest assistant text and stores the hash in `state.lastRenderedTextHash`. If `Stop` fires again with the same text (which can happen when CC re-fires on subagent boundaries), the second invocation no-ops.
- Diag log now records `textLen` and `retries` per event so timing issues are visible at a glance.

### Why
Symptom: turning HTML mode on in a fresh CC session, asking for a repo overview, getting a substantive multi-section reply - but no `[to-html · ...]` line and no file. `/to-html diag` showed the hook *was* firing, just classifying the wrong content. Root cause was the transcript-flush race, not registration.

## v1.0.1

### Added
- `/to-html diag` (or `debug`, `doctor`, `status`) prints plugin version, current mode, state file path, recent hook events, and recovery hints. Run it whenever the hook seems silent - it tells you whether the Stop hook is firing at all.
- `lib/diag.js` writes a one-line JSON event per hook invocation to `~/Library/Caches/cc-to-html/diag/hook.log` (capped at 256 KB / 200 lines).
- `bin/diagnose.js` reads state + recent log + version into a single human-readable report.

### Why
- CC's `/plugin update` downloads the new files but may not re-register hooks until `/reload-plugins` (or a full CC restart). The previous version had no way to tell whether a "silent" plugin was misbehaving or just waiting for a reload. Now `/to-html diag` answers that immediately.

## v1.0.0

### Added
- Content-aware classifier. Each assistant reply is routed to one of: `skip`, `prose`, `plan`, `comparison`, `explainer`. Trivial replies (under 240 chars, no structure) skip rendering.
- Five visual templates, one CSS file each, distinct identity per content type. No shared prose stylesheet recolored.
- Decision-bar interaction model. Every "Copy as prompt" button emits only what the user selected, never the full input.
  - Plan: per-task focus checkbox + optional inline note. Copy emits selected tasks grouped by phase.
  - Comparison: radio per option + one-line reason field. Copy emits the picked option and reason.
  - Prose and explainer have no copy button.
- Override mechanism. Prepend a fenced ```to-html``` JSON block to a reply to force a template.
- Test suite: 64 tests covering classifier, plan-extractor, sanitize, paths, state, render.

### Hardened
- `sessionId` sanitization in `paths.js`. Path-traversal payloads (`../../etc/...`) are hashed instead of joined raw. Defense-in-depth: assert resolved path stays under cache root.
- `turnIndex` coerced to non-negative integer. No more filename traversal via numeric inputs.
- Atomic writes for `state.json` and rendered HTML files. Eliminates mid-write truncation visible to the 3-second plan auto-reload.
- `readState` recovers from corrupted JSON by quarantining the file and returning defaults.
- Schema migration in `readState`. Old `activePlan` shapes from previous versions are dropped on load.
- Markdown size cap (2 MB). Plan markdown cap (512 KB). Override fence cap (64 KB).
- Stdin read in hooks has a 5-second timeout. Hooks never hang.
- Transcript line cap (1 MB) - pathological lines are skipped, not parsed.
- `post-tool-hook` defensively coerces `tool_input` whether it arrives as object, JSON string, or plain plan markdown.
- Plan extractor tracks fenced code blocks. Tasks inside ``` fences are no longer parsed.
- Plan extractor deduplicates phase and task IDs on collisions.
- `applyStatusFromText` skips tasks shorter than 3 chars. Prevents empty-text infinite match.
- Inlined plan JSON additionally escapes `>` and U+2028 / U+2029 for cross-engine safety.
- Comparison option ids deduplicated when the LLM repeats `## Option A`.

### Removed
- "Copy as markdown" button that dumped the full plan. Replaced with intent-capturing decision bar.
- "Generated by cc-to-html. CSP locks this artifact…" footer.
- Per-turn copy-as-prompt button in prose/explainer templates. They have nothing to copy.
- Old monolithic `template.js` and `plan-template.js`. Logic moved into `lib/templates/`.
- The `to-html-schema` skill. Server-side classification replaces it.
- The `/to-html plan <path>` and `/to-html:html` alias commands. Plan rendering happens automatically via the `ExitPlanMode` hook.

### Layout
```
skills/to-html/SKILL.md
lib/
  classifier.js       skip → comparison → plan → explainer → prose
  plan-extractor.js   markdown → structured phases/tasks
  sanitize.js         tag/attr allowlist
  markdown.js         vendored marked wrapper
  state.js            per-project JSON, atomic writes
  paths.js            per-OS cache dirs, sessionId sanitization
  io.js               shared stdin reader + atomic file write
  open.js             cross-platform browser launcher
  templates/
    dispatch.js       shell + template selection, fallback to prose on error
    prose.js, plan.js, comparison.js, explainer.js
bin/
  cli.js              toggle state
  render.js           per-turn rendering entrypoint
  plan-renderer.js    explicit plan rendering entrypoint
  stop-hook.js        Stop hook: reads transcript, renders, updates plan
  post-tool-hook.js   PostToolUse on ExitPlanMode
assets/
  base.css, prose.css, plan.css, comparison.css, explainer.css
  plan-runtime.js, comparison-runtime.js
vendor/marked.min.js  v13.0.3, MIT
test/                 64 tests via node --test
```
