---
name: to-html-schema
description: When HTML mode is on and the user wants interactive controls in the rendered artifact (sliders, dropdowns, checkboxes, radio choices, or drag-drop kanban), embed a fenced code block tagged `html-spec` containing JSON that follows this schema. Use when user asks for tuning UI, decision triage, option comparison, or anything beyond static prose.
---

# `html-spec` JSON schema

When HTML rendering mode is on (toggled via `/to-html`), the Stop hook extracts any fenced code blocks tagged `html-spec` from your response, parses them as JSON, and renders them as interactive controls below the prose.

You should only include an `html-spec` block when the user explicitly wants interactivity. Pure prose, plans, tables, and code reviews need no spec block — markdown alone renders cleanly.

## Top-level shape

```json
{
  "id": "optional-stable-id",
  "title": "Section heading shown in the controls panel",
  "description": "Short paragraph explaining what to do.",
  "controls": [ ... ]
}
```

You may emit multiple `html-spec` blocks in a single response; each becomes its own panel.

## Control types

### Slider
```json
{
  "type": "slider",
  "id": "duration-ms",
  "label": "Animation duration (ms)",
  "min": 100,
  "max": 1000,
  "step": 50,
  "value": 300,
  "help": "Lower is snappier."
}
```

### Dropdown
```json
{
  "type": "dropdown",
  "id": "easing",
  "label": "Easing curve",
  "value": "ease-out",
  "options": [
    { "value": "linear", "label": "Linear" },
    { "value": "ease-out", "label": "Ease-out (default)" },
    { "value": "spring", "label": "Spring" }
  ]
}
```

### Checkbox
```json
{
  "type": "checkbox",
  "id": "reduce-motion",
  "label": "Respect prefers-reduced-motion",
  "value": true
}
```

### Radio choice
```json
{
  "type": "choice",
  "id": "approach",
  "label": "Implementation approach",
  "value": "render-script",
  "options": [
    { "value": "prompt-template", "label": "Prompt + template" },
    { "value": "render-script", "label": "Renderer script (recommended)" },
    { "value": "local-server", "label": "Local server" }
  ]
}
```

### Kanban (drag-drop triage)
```json
{
  "type": "kanban",
  "id": "triage",
  "label": "Triage tickets",
  "columns": [
    { "id": "now", "label": "Now" },
    { "id": "next", "label": "Next" },
    { "id": "later", "label": "Later" },
    { "id": "cut", "label": "Cut" }
  ],
  "cards": [
    { "id": "tkt-1", "label": "Fix login timeout", "column": "now", "note": "P0 / 2 customer reports" },
    { "id": "tkt-2", "label": "Refactor auth middleware", "column": "next", "note": "blocks DX work" },
    { "id": "tkt-3", "label": "Onboarding tooltip copy", "column": "later" }
  ]
}
```

## Two-way export

The rendered HTML has a "Copy as prompt" button. When clicked, it collects every control's current state and writes a JSON-tagged prompt to the user's clipboard. The user pastes that back into Claude Code in their next turn — that's how decisions made in the browser flow back to you. Anticipate this round trip when writing your response.

## Rules

- Always wrap the spec in a fenced code block tagged exactly `html-spec`. No other tag works.
- All `id` values within a single spec must be unique. Across specs, prefix with the spec id.
- Do not embed raw HTML inside spec values; everything is escaped.
- Keep spec blocks small. If you find yourself emitting more than ~10 controls, group into multiple specs.
- Never embed JavaScript, URLs to external resources, or anything that requires network. The CSP forbids it; it will not load.

## When NOT to use

- Linear plans, ADRs, code reviews, PR writeups: markdown alone is fine.
- Anything the user could express by editing a markdown table.
- Static comparisons that don't need real-time selection.
