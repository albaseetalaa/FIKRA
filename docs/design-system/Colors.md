# FIKRA Color System

**Doc ID:** UI-03<br>
**Status:** Token architecture binding; complete provisional v1 color contract — literal values remain provisional pending final brand approval<br>
**Depends on:** UI-01<br>
**Referenced by:** UI-02 and accessibility validation

## 1. Binding model

FIKRA separates color into two layers:

1. **Primitive palette tokens** hold literal values and scales.
2. **Semantic color tokens** describe product intent and are the only color tokens components may consume.

Literal values are allowed only in the token definition layer. Current literal values are placeholders until the brand palette is approved.

## 2. Primitive palette tokens — provisional

```text
color.primitive.primary.{50–900}
color.primitive.accent.{50–900}
color.primitive.neutral.{0–950}
color.primitive.green.{50–900}
color.primitive.amber.{50–900}
color.primitive.red.{50–900}
color.primitive.blue.{50–900}
```

Primitive tokens must not be referenced directly inside components.

## 3. Semantic tokens — binding

```text
color.surface.canvas
color.surface.subtle
color.surface.raised
color.surface.inverse
color.surface.overlay

color.text.primary
color.text.secondary
color.text.muted
color.text.inverse
color.text.disabled
color.text.link

color.border.default
color.border.strong
color.border.focus
color.border.disabled

color.action.primary.background
color.action.primary.foreground
color.action.primary.hover
color.action.secondary.background
color.action.secondary.foreground
color.action.secondary.hover
color.action.destructive.background
color.action.destructive.foreground

color.status.success.background
color.status.success.foreground
color.status.warning.background
color.status.warning.foreground
color.status.error.background
color.status.error.foreground
color.status.info.background
color.status.info.foreground
```

Components use only these purpose-based aliases. Direct use of `primary-*`, `accent-*`, `neutral-*`, `slate-*`, `brand-*`, or other palette steps in a component is a design-system violation. This document defines exactly these 31 semantic tokens; no token is added, removed, or renamed by this revision.

## 4. Primitive anchors — provisional v1 values

### 4.1 Primary scale — aliased to the existing implementation

The conceptual `color.primitive.primary.*` scale is implemented in v1 by the repository's existing CSS `--color-brand-*` scale. This is an intentional alias describing one scale, not two competing primary scales: every `primary.*` step below **is** the corresponding `--color-brand-*` custom property already declared in `src/app/globals.css`. This document does not modify those CSS declarations; it records the mapping between the conceptual primitive name and the value the repository already implements.

The earlier temporary anchor (`primary.500: #1A1A2E`) is superseded by this table. It must no longer be treated as the v1 implementation value — the existing repository brand scale below is authoritative for v1.

| Primitive anchor              | Implementation variable | Value     |
| ----------------------------- | ----------------------- | --------- |
| `color.primitive.primary.50`  | `--color-brand-50`      | `#EEF4FF` |
| `color.primitive.primary.100` | `--color-brand-100`     | `#DCE8FF` |
| `color.primitive.primary.200` | `--color-brand-200`     | `#B8D1FF` |
| `color.primitive.primary.300` | `--color-brand-300`     | `#8AB1FF` |
| `color.primitive.primary.400` | `--color-brand-400`     | `#5C8BFF` |
| `color.primitive.primary.500` | `--color-brand-500`     | `#3A63F5` |
| `color.primitive.primary.600` | `--color-brand-600`     | `#2A48D8` |
| `color.primitive.primary.700` | `--color-brand-700`     | `#2338AC` |
| `color.primitive.primary.800` | `--color-brand-800`     | `#1F2F87` |
| `color.primitive.primary.900` | `--color-brand-900`     | `#1C296B` |

### 4.2 Neutral scale — provisional v1 values

| Primitive anchor              | Value     |
| ----------------------------- | --------- |
| `color.primitive.neutral.0`   | `#FAFAFC` |
| `color.primitive.neutral.50`  | `#F5F6FA` |
| `color.primitive.neutral.100` | `#ECEEF3` |
| `color.primitive.neutral.200` | `#DDE0E8` |
| `color.primitive.neutral.300` | `#C5CAD5` |
| `color.primitive.neutral.400` | `#9AA2B1` |
| `color.primitive.neutral.500` | `#6B7280` |
| `color.primitive.neutral.600` | `#4B5563` |
| `color.primitive.neutral.700` | `#374151` |
| `color.primitive.neutral.800` | `#252A35` |
| `color.primitive.neutral.900` | `#191B25` |
| `color.primitive.neutral.950` | `#0F0F1A` |

### 4.3 Accent, green, amber, red, and blue anchors — unchanged

| Primitive anchor             | Placeholder | Purpose of placeholder              |
| ---------------------------- | ----------: | ----------------------------------- |
| `color.primitive.accent.500` |   `#E94560` | Temporary warm accent anchor        |
| `color.primitive.green.600`  |   `#16A34A` | Temporary success anchor            |
| `color.primitive.red.600`    |   `#DC2626` | Temporary error anchor              |
| `color.primitive.green.50`   |   `#F0FDF4` | Temporary success background anchor |
| `color.primitive.green.800`  |   `#166534` | Temporary success foreground anchor |
| `color.primitive.amber.50`   |   `#FFFBEB` | Temporary warning background anchor |
| `color.primitive.amber.800`  |   `#92400E` | Temporary warning foreground anchor |
| `color.primitive.red.50`     |   `#FEF2F2` | Temporary error background anchor   |
| `color.primitive.red.800`    |   `#991B1B` | Temporary error foreground anchor   |
| `color.primitive.blue.50`    |   `#EFF6FF` | Temporary info background anchor    |
| `color.primitive.blue.800`   |   `#1E40AF` | Temporary info foreground anchor    |

These anchors are implementation placeholders only. They must not be presented as the final FIKRA identity, and the full accessible scales must be generated and reviewed before production use.

## 5. Semantic mappings — provisional v1 (complete)

Every one of the 31 semantic tokens declared in Section 3 has exactly one mapping below. No semantic token is left unmapped.

### 5.1 Surface

| Semantic token          | Maps to                                                   | Value                                                              |
| ----------------------- | --------------------------------------------------------- | ------------------------------------------------------------------ |
| `color.surface.canvas`  | `color.primitive.neutral.0`                               | `#FAFAFC`                                                          |
| `color.surface.subtle`  | `color.primitive.neutral.50`                              | `#F5F6FA`                                                          |
| `color.surface.raised`  | `color.primitive.neutral.0`                               | `#FAFAFC`                                                          |
| `color.surface.inverse` | `color.primitive.neutral.950`                             | `#0F0F1A`                                                          |
| `color.surface.overlay` | `color.primitive.neutral.950` composited at `56%` opacity | `color-mix(in srgb, color.primitive.neutral.950 56%, transparent)` |

`color.surface.raised` intentionally shares its literal value with `color.surface.canvas`. Raised surfaces are differentiated from canvas through elevation (shadow/border), not through a second near-white fill — no additional neutral primitive is introduced for this purpose.

`color.surface.overlay` is a derived alpha value, not a new hue or primitive family: it is `color.primitive.neutral.950` composited at 56% opacity, expressed as `color-mix(in srgb, color.primitive.neutral.950 56%, transparent)`.

### 5.2 Text

| Semantic token         | Maps to                       | Value                                                   |
| ---------------------- | ----------------------------- | ------------------------------------------------------- |
| `color.text.primary`   | `color.primitive.neutral.950` | `#0F0F1A`                                               |
| `color.text.secondary` | `color.primitive.neutral.700` | `#374151`                                               |
| `color.text.muted`     | `color.primitive.neutral.600` | `#4B5563`                                               |
| `color.text.inverse`   | `color.primitive.neutral.0`   | `#FAFAFC`                                               |
| `color.text.disabled`  | `color.primitive.neutral.400` | `#9AA2B1`                                               |
| `color.text.link`      | `color.primitive.primary.600` | `#2A48D8` (implemented as existing `--color-brand-600`) |

`color.text.disabled` is intentionally low-emphasis. Its contrast ratio against `color.surface.canvas` (see Section 6) is below the normal-text `4.5:1` requirement by design — WCAG's normal-text contrast requirement does not apply to content that is genuinely disabled and not intended to be read or operated.

### 5.3 Border

| Semantic token          | Maps to                       | Value                                                   |
| ----------------------- | ----------------------------- | ------------------------------------------------------- |
| `color.border.default`  | `color.primitive.neutral.300` | `#C5CAD5`                                               |
| `color.border.strong`   | `color.primitive.neutral.500` | `#6B7280`                                               |
| `color.border.focus`    | `color.primitive.primary.500` | `#3A63F5` (implemented as existing `--color-brand-500`) |
| `color.border.disabled` | `color.primitive.neutral.200` | `#DDE0E8`                                               |

### 5.4 Action

| Semantic token                        | Maps to                       | Value                                                   |
| ------------------------------------- | ----------------------------- | ------------------------------------------------------- |
| `color.action.primary.background`     | `color.primitive.primary.700` | `#2338AC` (implemented as existing `--color-brand-700`) |
| `color.action.primary.foreground`     | `color.primitive.neutral.0`   | `#FAFAFC`                                               |
| `color.action.primary.hover`          | `color.primitive.primary.800` | `#1F2F87` (implemented as existing `--color-brand-800`) |
| `color.action.secondary.background`   | `color.primitive.neutral.0`   | `#FAFAFC`                                               |
| `color.action.secondary.foreground`   | `color.primitive.neutral.950` | `#0F0F1A`                                               |
| `color.action.secondary.hover`        | `color.primitive.neutral.100` | `#ECEEF3`                                               |
| `color.action.destructive.background` | `color.primitive.red.600`     | `#DC2626`                                               |
| `color.action.destructive.foreground` | `color.primitive.neutral.0`   | `#FAFAFC`                                               |

**Outlined secondary-action boundary rule.** The v1 secondary action is an outlined control, not a filled one. Its background is permitted to equal `color.surface.canvas`; its visible component boundary is supplied by `color.border.strong`, not by a distinct background fill. The applicable non-text boundary contrast test for the secondary action is therefore `color.border.strong` against `color.surface.canvas` (see Section 6), not the secondary background against canvas. The strong border remains present through the hover state — `color.action.secondary.hover` changes only the fill, not the boundary. Consequently, the secondary background's `1:1` relationship with canvas is expected and correct for an outlined control; it is not, by itself, an accessibility failure.

This correction does not add new action states (e.g. active or pressed); it clarifies the existing `default`, `hover`, and disabled-via-component states already scoped by `Components.md`.

### 5.5 Status — unchanged

| Semantic token                    | Maps to                     | Value     |
| --------------------------------- | --------------------------- | --------- |
| `color.status.success.background` | `color.primitive.green.50`  | `#F0FDF4` |
| `color.status.success.foreground` | `color.primitive.green.800` | `#166534` |
| `color.status.warning.background` | `color.primitive.amber.50`  | `#FFFBEB` |
| `color.status.warning.foreground` | `color.primitive.amber.800` | `#92400E` |
| `color.status.error.background`   | `color.primitive.red.50`    | `#FEF2F2` |
| `color.status.error.foreground`   | `color.primitive.red.800`   | `#991B1B` |
| `color.status.info.background`    | `color.primitive.blue.50`   | `#EFF6FF` |
| `color.status.info.foreground`    | `color.primitive.blue.800`  | `#1E40AF` |

- These mappings are unchanged from the prior revision of this document and remain implementation placeholders; they do not constitute approval of the final FIKRA palette.
- Components still consume only the semantic tokens in Section 3 — never `color.primitive.*` directly.

## 6. Contrast verification — provisional v1

Every foreground/background and boundary pair below is calculated from the literal values in Sections 4–5 using the standard WCAG relative-luminance contrast formula.

| Pair                                                            |     Ratio | Requirement                                        | Result               |
| --------------------------------------------------------------- | --------: | -------------------------------------------------- | -------------------- |
| Text primary on canvas                                          | `18.25:1` | `4.5:1`                                            | Pass                 |
| Text secondary on canvas                                        |  `9.89:1` | `4.5:1`                                            | Pass                 |
| Text muted on canvas                                            |  `7.25:1` | `4.5:1`                                            | Pass                 |
| Text inverse on inverse surface                                 | `18.25:1` | `4.5:1`                                            | Pass                 |
| Text disabled on canvas                                         |  `2.46:1` | Not applicable — disabled content, see Section 5.2 | Documented exception |
| Link on canvas                                                  |  `6.68:1` | `4.5:1`                                            | Pass                 |
| Primary-action foreground on background                         |  `9.02:1` | `4.5:1`                                            | Pass                 |
| Primary-action foreground on hover background                   | `11.10:1` | `4.5:1`                                            | Pass                 |
| Secondary-action foreground on background                       | `18.25:1` | `4.5:1`                                            | Pass                 |
| Secondary-action foreground on hover background                 | `16.39:1` | `4.5:1`                                            | Pass                 |
| Secondary-action outlined boundary (`border.strong` vs. canvas) |  `4.64:1` | `3:1`                                              | Pass                 |
| Destructive-action foreground on background                     |  `4.63:1` | `4.5:1`                                            | Pass                 |
| Focus indicator vs. canvas                                      |  `4.70:1` | `3:1`                                              | Pass                 |
| Focus indicator vs. inverse surface                             |  `3.88:1` | `3:1`                                              | Pass                 |
| Status success foreground/background                            |  `6.81:1` | `4.5:1`                                            | Pass                 |
| Status warning foreground/background                            |  `6.84:1` | `4.5:1`                                            | Pass                 |
| Status error foreground/background                              |  `7.60:1` | `4.5:1`                                            | Pass                 |
| Status info foreground/background                               |  `8.01:1` | `4.5:1`                                            | Pass                 |

- Normal text: minimum `4.5:1` contrast.
- Large text and essential non-text UI: minimum `3:1` where WCAG permits.
- Focus indicators and meaningful state boundaries: minimum `3:1` against adjacent colors.
- Statuses must pair color with text, iconography, or another non-color cue.
- Every semantic foreground/background pair must be tested in its real component context in addition to this token-level verification.

Generated customer brand content is not application chrome and may use the customer's palette. Studios must still analyze that content, flag accessibility failures, and avoid allowing customer colors to leak into FIKRA navigation or controls.

## 7. Dark mode

Dark mode is not committed for v1. The token architecture must remain theme-ready, but no v1 component may introduce or depend on `dark:` behavior. Existing `dark:` classes are audit findings to be handled in an approved implementation task, not silently changed during documentation work.

## 8. Implementation acceptance criteria

- All aliases resolve centrally through the token layer.
- No raw colors appear in components.
- No component consumes a primitive palette step directly.
- Contrast tests cover default, hover, active, disabled, focus, error, and selected states.
- Final brand palette replacement requires no component API changes.

## 9. Governance

The values in Sections 4 and 5 are governed design tokens. They may change only through a reviewed design-system decision recorded in this document, not silently during an implementation task. Implementation PRs consume these mappings; they do not redefine them.
