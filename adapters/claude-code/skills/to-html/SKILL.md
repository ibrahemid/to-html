---
name: to-html
description: Configure to-html artifact appearance (theme, size, width, font) and show status. Use when the user types /to-html or /to-html config .... to-html no longer auto-renders replies; to BUILD an artifact, the to-html-make skill handles requests like "build me html of X". This skill is config only.
---

The user invoked `/to-html`. to-html does not render replies automatically; it builds
a self-contained HTML artifact on demand (see the `to-html-make` skill).

- starts with `config` (e.g. `/to-html config theme dark`) → **config flow**
- otherwise → **status flow**

## Status flow

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/cli.js" config show
```

Print the `message` field as one line, then add: `To build an artifact, just ask (e.g. "build me html of X").`

## Config flow

These set the default appearance applied to every artifact. Pass the user's
arguments through:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/cli.js" config theme dark
node "${CLAUDE_PLUGIN_ROOT}/bin/cli.js" config size l
node "${CLAUDE_PLUGIN_ROOT}/bin/cli.js" config width comfortable
node "${CLAUDE_PLUGIN_ROOT}/bin/cli.js" config font sans
node "${CLAUDE_PLUGIN_ROOT}/bin/cli.js" config show
```

Valid keys and values:

- `theme` - `auto` | `light` | `dark` | `sepia`
- `size` - `s` | `m` | `l` | `xl`
- `width` - `narrow` | `comfortable` | `wide`
- `font` - `sans` | `serif`

Print the `message` field. If the cli returned `ok: false`, print the `error` field as the one line.
