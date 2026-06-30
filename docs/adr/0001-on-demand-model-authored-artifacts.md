# ADR 0001: to-html is an on-demand, model-authored artifact layer

Status: Proposed (owner sign-off pending, see Decision gate)
Date: 2026-06-30

## Context

The shipped product (v2.1.3) auto-renders every substantive assistant reply into
HTML via a Stop hook, with a cheap haiku enrichment pass deriving a TL;DR + mermaid
map, and an authoring contract injected so the model's replies fit the renderer.

Evidence against this shape (mined from 835 sessions, 331 unique html prompts, and
three deep owner threads):

- The dominant real intent (~82 prompts, ~43% of real prompts, across 16 projects)
  is "build me a task-aware HTML artifact": status/handoff dashboards, linked
  reports, options/mockup pickers, system diagrams, checklists, asset-download
  grids, findings viewers. ~85% require the MAIN model's task context, not a
  re-render of the last reply.
- The trigger is mid-task and on-demand ("build me tmp html of X", "show me in
  html", "update the status html"), driven by a long reply being hard to read or a
  decision being pending.
- Owner statements indict the current design directly (2026-05-28):
  - "to-html must not enforce such pattern" / "we should not alter how the model
    response by much" / "graph TD and other things... this is the actual bug".
  - "its optional which means i can click html content or request it after response
    or if mode is auto then i can see link for html to open".
  - "to-html is another layer, not double code but its simplifr not just displayer".
  - the stale-artifact bug ("renders only when it thinks it should, not every turn")
    is the symptom that proves the every-reply model is broken.
- Real-use artifact expectations (2026-06-11, nejoum): editable in place for his own
  data; he does NOT assume edits persist ("will it preset or we just print there");
  once told edits are localStorage-only he treated HTML as a self view/edit surface
  and moved sharing to structured export ("lets do the sheet or excel so i can
  import"). "single html is dream"; multi-file/asset breakage is a recurring failure.

## The question this ADR must answer

What does to-html add over just asking Claude "build me an html" each time? If the
answer is "nothing but a prompt," the honest call is a thin skill or dropping it.

The defensible value-add (capabilities bare-model output does not reliably deliver):

1. Anti-slop design system baked in: a disciplined, consistent, non-generic look
   every time without re-specifying it. The owner polices AI-slop relentlessly;
   this removes that loop.
2. Guaranteed single self-contained file: deterministic inlining of CSS/JS/SVG and
   image data URIs, sanitized. No external-asset breakage. ("single html is dream".)
3. Reliable open in the configured browser (macOS default vs Dia), which a bare
   reply cannot do.
4. A library of first-class artifact kinds the model composes from, so structure is
   proven instead of improvised per request: consistency and speed.
5. Living-document lifecycle: named, gitignored, date-stamped, regenerated in place.
6. The distill/simplify layer ("simplifr not just displayer"): a purpose-built
   simpler view, not a dump of the reply.
7. The mermaid->SVG render primitive (the hardest part) is already owned.

These are real only if they are enforced in deterministic code, not prompt text.
That requirement shapes the decision below.

## Decision

Rebuild to-html as an on-demand, model-authored artifact LAYER.

1. Content vs assembly split (this is "another layer, not double code"):
   - The MAIN model, with full task context, authors a STRUCTURED ARTIFACT SPEC
     (kind + title + typed sections/items), not raw HTML/CSS.
   - to-html's deterministic core ASSEMBLES the spec into a single self-contained,
     sanitized file using the chosen kind's template and the anti-slop design
     system. The design system lives in the core, so quality is guaranteed, not
     improvised. The model never hand-writes the chrome.

2. Invocation:
   - A skill/tool the main model invokes when the user asks ("build me html of X",
     "show me in html", "update the status html"), plus an explicit slash command.
   - No authoring contract on normal replies. The model writes normally and emits a
     spec only when asked.

3. Modes:
   - Default: on-demand only.
   - Optional auto-mode = LINK ONLY. A quiet hook may detect "this reply would
     benefit from an artifact" and surface a single clickable link to generate/open
     it. It never renders inline and never alters the reply. Off by default. This
     honors "if mode is auto then i can see link for html to open" while removing
     the noise and the contract.
   - The Stop-hook forced per-reply render and the UserPromptSubmit contract are
     removed.

4. Artifact kinds (the proven clusters): status/handoff dashboard, linked report
   (table + links, supports "plain no css"), options/mockup picker, system
   diagram/flow (reuses the render primitive), checklist/test sheet,
   asset-download grid, findings/inventory viewer.

5. Persistence and share (decided explicitly, matching observed behavior):
   - The HTML artifact is the owner's own VIEW/EDIT surface. Interactive edits
     (checkbox approvals, editable cells) live in localStorage keyed by artifact id,
     per-browser, and the artifact states this in-line ("edits are local to this
     browser").
   - Sharing the VIEW: the single self-contained file is shareable read-only as-is.
   - Sharing DATA to others: tabular kinds expose an in-artifact export (CSV and
     xlsx) so it re-imports into Sheets/Docs. The HTML is not the shared-state
     vector; the export is.

6. Cross-tool: the content->assembly core and the artifact-kind library live in
   core/ + shared/ (tool-agnostic, deterministic, zero runtime deps). Adapters hold
   only the per-tool invocation + browser-open glue. Matches the existing layout.

## Consequences

- Most of the existing core is reused (templates, sanitize, mermaid render,
  self-contained assembly). The change re-points the entrypoint from
  "Stop-hook over the last reply" to "model invokes with a structured spec," and
  deletes the contract + forced render. Lower risk than greenfield.
- `core/lib/summary.js` (extract-TL;DR-from-reply) and the per-turn enrichment
  belong to the deleted auto path; they are removed, not fixed. The HIGH ReDoS in
  summary.js is therefore moot post-rebuild (relevant only if v2.1.3 stays published
  during transition: decided to leave v2.1.3 as-is and supersede, not patch).
- The owner gets a consistent, openable, single-file artifact per request without
  re-specifying design or fighting slop. That is the value-add or the rebuild fails.
- New surface (artifact spec schema, kind templates, export) needs tests and golden
  fixtures per kind, validated against the 15 acceptance scenarios in the corpus
  brief.

## Decision gate

This is the foundational product shape and the owner has previously weighed dropping
vs harnessing it. Build does not start until the owner confirms: rebuild (this ADR)
vs thin-skill vs drop. Recommendation: rebuild, because the value-add (1-7) holds and
is enforceable in deterministic core. First deliverable after sign-off is one kind
end-to-end (status/handoff dashboard) as a tracer bullet the owner can open.

## Alternatives considered

- Polish the current auto-render (v2.2 epic): rejected. It perfects the shape the
  owner rejected ("must not enforce such pattern", stale-artifact bug).
- Thin skill (a prompt that tells the model to write HTML): rejected as the primary
  shape because it delivers none of the enforced guarantees (design system,
  single-file, opener, kinds); it is what bare-model already does.
- Keep auto inline render as an option: rejected; replaced by link-only auto-mode.
