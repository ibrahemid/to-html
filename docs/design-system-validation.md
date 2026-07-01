# Design system validation

What was tested when the token-driven design system (ADR 0002) was applied to the
seven artifact kinds, the shell, and the site, and what it turned up. Validation ran
in rounds: a tracer bullet on the richest kind (dashboard) across every axis first,
then the same axes spot-checked across the remaining kinds after fan-out.

## Axes

- Themes: light, dark, sepia, and OS-preference auto. Rendered each kind under each.
- Contrast: every text/surface and status/surface pair composited over its theme
  surface and checked against WCAG (AA for body, AA-large for chrome). All pass. The
  one failure found (dark primary-fill button text) was fixed by switching the
  on-accent color to white and deepening the solid fill.
- Width: desktop (1280) and phone (390). Reading controls (size, width, serif/sans)
  drive tokens and were exercised through the theme renders.
- Overflow: long unbreakable tokens (URLs, giant words), very long titles, many
  sections and items. First round showed a horizontal-scroll break on phone; fixed
  with `overflow-wrap: anywhere` on labels, details, table cells, names, and captions.
- Bidirectional: Arabic and mixed EN/AR content. `dir="auto"` plus logical properties
  mirror the whole layout, including the status rails, pill dots, and the corner
  stamp, with no per-kind RTL code.
- Minimal and empty: single-item dashboards, a lone checklist item, findings with no
  severity. No layout collapse.
- Sanitization and XSS: unchanged from before the redesign (CSS-only work did not
  touch the markdown or URL sanitizer); `sanitize.test.js` and the per-kind escaping
  assertions stay green.
- Accessibility: a global `:focus-visible` ring, status conveyed by a text pill and a
  label (not color alone), motion suppressed under `prefers-reduced-motion`.
- Print: white background, black text, shadows removed, corner stamp hidden, `@page`
  margins.

## Findings and fixes

1. Dark primary-fill button text failed AA (3.82:1). Fixed: on-accent is white, solid
   fill deepened. Re-checked: all pairs pass.
2. Long unbreakable tokens forced horizontal scroll on phone. Fixed with
   `overflow-wrap: anywhere` on the text-bearing elements in every kind.
3. Status color was hardcoded hex per kind and would not hold across themes. Fixed by
   routing status and severity through theme-tuned tone tokens and a shared pill.
4. The fixed corner stamp overlapped content at the bottom of a phone viewport. Fixed
   by hiding it under 600px and making it non-interactive.
5. Sepia was declared `color-scheme: dark` while being a light surface. Fixed to
   `color-scheme: light`.

## Status

All seven kinds, the shell, and the site render under one identity across every axis
above. `npm test --workspaces` and `npm run lint -- --max-warnings 0` are green and the
kind goldens were regenerated on purpose.
