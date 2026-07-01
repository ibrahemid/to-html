# ADR 0002: the to-html design system

Status: Accepted
Date: 2026-07-02
Supersedes the ad-hoc per-kind styling and the divergent site palette.

## Context

to-html assembles seven artifact KINDS (dashboard, report, options, diagram,
checklist, asset-grid, findings) into single self-contained files, plus a marketing
site. Before this ADR each kind carried its own stylesheet with hand-picked hex, the
artifacts used a violet accent while the site used orange, and there was no shared
token layer. The look read as generic and the identity was incoherent across surfaces.

The job is specific and it constrains the design more than a general UI would:

- Information-first and dense. Artifacts exist to make an agent's output clear, not
  to decorate it.
- One self-contained file under a strict CSP (`default-src 'none'; style-src
  'unsafe-inline'; img-src data:`). No web fonts, no external assets, must work from
  `file://` and offline.
- Three themes (light, dark, sepia) plus reading controls (size, width, serif/sans).
- Bidirectional: English and Arabic, mixed, must both read correctly.
- Print-friendly and accessible (WCAG contrast, keyboard focus, reduced motion).
- Cross-tool: the system lives in the deterministic core, not in any adapter.

## Decision

One token-driven design system, sourced from `core/assets/tokens.css`, consumed by
every kind, the assembly shell, and the site. The identity is editorial-technical:
a grayscale-dominant surface, one accent hue rationed for interaction, semantic status
color as theme-aware tokens, a mono "instrument" voice for micro-labels, and structure
carried by hairlines and tint rather than drop shadows.

### Foundations chosen for fit (not brand copying)

Each mechanic is taken from a strong system and justified against to-html's job:

- Grayscale-dominant surface with a single rationed accent (Vercel Geist,
  https://vercel.com/geist/colors). Density stays calm when hue is scarce.
- Semantic color as tokens, not literals, with light/dark parity (GitHub Primer,
  https://primer.style/foundations/color). A status never invents a color; it names a
  tone role that each theme resolves.
- Theme as a small set of tuned roles, borders over shadows (Linear,
  https://linear.app/now/how-we-redesigned-the-linear-ui). Print-safe and portable
  across the three themes.
- A 4px spacing grid and a fixed modular type scale (IBM Carbon,
  https://carbondesignsystem.com/elements/spacing/overview/). One density knob.
- Contrast by construction and the paired-step badge (Stripe,
  https://stripe.com/blog/accessible-color-systems). Status pills hold contrast across
  every tone.
- Positional, role-based tokens over ad-hoc names (Radix Colors,
  https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale).

### Token layers

1. `tokens.css` (single source of truth): non-color scales that are theme-independent
   (type, space on a 4px grid, radius, border widths, motion, font stacks, reading
   controls) and color ROLES that each theme sets (surface, text, border, code, one
   accent, five semantic tones). No kind defines a color; every kind reads a token.
2. `base.css` (primitives): resets, element styles, the focus ring, print rules, and
   the shared component vocabulary: `.cc-eyebrow` (the mono micro-label every kind
   stamps its name with) and `.cc-pill` + `.tone-*` (one pill geometry, five semantic
   tones). Dashboard statuses and findings severities both render as tone pills.
3. Per-kind stylesheets: layout only, built from tokens and primitives.

### Accent

One indigo-violet accent (`#4a37c8` light, `#a99bff` dark, `#4a3a86` sepia). It is the
hue maximally separated on the wheel from the warm semantic lanes (red ~0-25, amber
~50-80, green ~120-160), so interaction color can never be misread as done/pending/
blocked, and it is far enough off pure blue not to read as a default hyperlink. The
accent is tuned per theme for contrast, so identity is one hue while contrast holds on
cool-white, warm-cream, and dark surfaces alike.

### Semantic tones

Five roles (`pos`, `neg`, `warn`, `info`, `muted`), each with `-fg`/`-bg`/`-bd`,
resolved per theme. Status and severity map onto them: done->pos, in_progress->accent,
pending->muted, blocked/critical->neg, decision/pending-warning->warn, low/info->info.

### Theming and controls

The existing `data-theme` (light/dark/sepia, plus OS-preference auto), `data-size`,
`data-width`, and `data-family` controls are preserved and now drive tokens. Sepia is a
light theme and is declared `color-scheme: light` (it was previously miscategorized as
dark).

### Bidirectional

The shell root is `dir="auto"` and the CSS uses logical properties (`margin-inline`,
`padding-inline`, `border-inline-start`, `inset-inline`). Direction follows content, so
an Arabic artifact mirrors structurally with no per-kind RTL patching.

### Accessibility stance

Every text/surface and status/surface pair is verified against WCAG (AA for body,
AA-large for UI chrome) by a contrast check over the composited token values. A visible
`:focus-visible` ring is global. Motion is suppressed under `prefers-reduced-motion`.
Elevation is borders and tint, so nothing depends on shadow to convey structure.

### Voice

Terse and factual. The mono eyebrow names the artifact kind. No decoration, no filler,
no hype. Copy passes the copy-gate.

## Consequences

- The generic look and the split palette are gone; one identity spans artifacts and
  site. Adding a kind means writing layout against existing tokens, not new color.
- Every golden snapshot changes (base.css and tokens are inlined into each file); the
  goldens are regenerated on purpose and reviewed per kind.
- The renderer stays zero-dependency and deterministic. Tokens are plain CSS custom
  properties inlined into the single file; nothing external is added.

## Alternatives considered

- A full Radix-style 1-12 numeric ramp per hue per theme: rejected as overbuilt for a
  renderer with three hand-tuned themes rather than runtime-generated palettes. Role
  tokens capture the same discipline (semantic naming, per-theme values, one accent)
  at a fraction of the surface.
- Embedding a brand webfont as base64 in every artifact: rejected. It fights the
  single-small-file goal and buys little over a deliberate system-font stack.
- Keeping per-kind styling and only unifying color: rejected. It leaves the identity
  ad-hoc and lets the next kind drift again.
