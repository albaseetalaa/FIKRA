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
color.action.primary.active
color.action.secondary.background
color.action.secondary.foreground
color.action.secondary.hover
color.action.secondary.active
color.action.ghost.background
color.action.ghost.foreground
color.action.ghost.hover
color.action.ghost.active
color.action.destructive.background
color.action.destructive.foreground
color.action.destructive.hover
color.action.destructive.active

color.status.success.background
color.status.success.foreground
color.status.warning.background
color.status.warning.foreground
color.status.error.background
color.status.error.foreground
color.status.info.background
color.status.info.foreground
```

Components use only these purpose-based aliases. Direct use of `primary-*`, `accent-*`, `neutral-*`, `slate-*`, `brand-*`, or other palette steps in a component is a design-system violation. This document defines exactly these 39 semantic tokens. Any future addition, removal, or rename must update this list and this count together.

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

| Primitive anchor             | Placeholder | Purpose of placeholder                                                                 |
| ---------------------------- | ----------: | -------------------------------------------------------------------------------------- |
| `color.primitive.accent.500` |   `#E94560` | Temporary warm accent anchor                                                           |
| `color.primitive.green.600`  |   `#16A34A` | Temporary success anchor                                                               |
| `color.primitive.red.600`    |   `#DC2626` | Temporary error anchor                                                                 |
| `color.primitive.red.700`    |   `#B91C1C` | Temporary error anchor — mid-step completing the scale between `red.600` and `red.800` |
| `color.primitive.green.50`   |   `#F0FDF4` | Temporary success background anchor                                                    |
| `color.primitive.green.800`  |   `#166534` | Temporary success foreground anchor                                                    |
| `color.primitive.amber.50`   |   `#FFFBEB` | Temporary warning background anchor                                                    |
| `color.primitive.amber.800`  |   `#92400E` | Temporary warning foreground anchor                                                    |
| `color.primitive.red.50`     |   `#FEF2F2` | Temporary error background anchor                                                      |
| `color.primitive.red.800`    |   `#991B1B` | Temporary error foreground anchor                                                      |
| `color.primitive.blue.50`    |   `#EFF6FF` | Temporary info background anchor                                                       |
| `color.primitive.blue.800`   |   `#1E40AF` | Temporary info foreground anchor                                                       |

These anchors are implementation placeholders only. They must not be presented as the final FIKRA identity, and the full accessible scales must be generated and reviewed before production use. `color.primitive.red.700` is a new provisional addition in this revision, completing the red scale's mid-step between the existing `red.600` and `red.800` anchors; it carries the same provisional status and remains governed by Section 9.

## 5. Semantic mappings — provisional v1 (complete)

Every one of the 39 semantic tokens declared in Section 3 has exactly one mapping below. No semantic token is left unmapped.

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
| `color.action.primary.active`         | `color.primitive.primary.900` | `#1C296B` (implemented as existing `--color-brand-900`) |
| `color.action.secondary.background`   | `color.primitive.neutral.0`   | `#FAFAFC`                                               |
| `color.action.secondary.foreground`   | `color.primitive.neutral.950` | `#0F0F1A`                                               |
| `color.action.secondary.hover`        | `color.primitive.neutral.100` | `#ECEEF3`                                               |
| `color.action.secondary.active`       | `color.primitive.neutral.200` | `#DDE0E8`                                               |
| `color.action.ghost.background`       | _(none — transparent)_        | `transparent`                                           |
| `color.action.ghost.foreground`       | `color.primitive.primary.600` | `#2A48D8` (implemented as existing `--color-brand-600`) |
| `color.action.ghost.hover`            | `color.primitive.neutral.100` | `#ECEEF3`                                               |
| `color.action.ghost.active`           | `color.primitive.neutral.200` | `#DDE0E8`                                               |
| `color.action.destructive.background` | `color.primitive.red.600`     | `#DC2626`                                               |
| `color.action.destructive.foreground` | `color.primitive.neutral.0`   | `#FAFAFC`                                               |
| `color.action.destructive.hover`      | `color.primitive.red.700`     | `#B91C1C`                                               |
| `color.action.destructive.active`     | `color.primitive.red.800`     | `#991B1B`                                               |

**Outlined secondary-action boundary rule.** The v1 secondary action is an outlined control, not a filled one. Its background is permitted to equal `color.surface.canvas`; its visible component boundary is supplied by `color.border.strong`, not by a distinct background fill. The applicable non-text boundary contrast test for the secondary action is therefore `color.border.strong` against `color.surface.canvas` (see Section 6), not the secondary background against canvas. The strong border remains present through the hover **and active** states — `color.action.secondary.hover` and `color.action.secondary.active` change only the fill, not the boundary. Consequently, the secondary background's `1:1` relationship with canvas is expected and correct for an outlined control; it is not, by itself, an accessibility failure.

**Ghost action.** Ghost has no visible border in any state. Its foreground (`color.action.ghost.foreground`) remains unchanged across hover and active — only the background fill changes, using the same neutral hover/active fills as the outlined secondary action. `transparent` is an intentional token-layer value for `color.action.ghost.background`, not an omitted styling decision: it is the explicit, documented default-state value, not the absence of one. The v1 ghost treatment is authorized only on the standard light `color.surface.canvas`/`color.surface.raised` surfaces. No inverse-surface ghost variant is introduced in this revision.

Active states for `primary`, `secondary`, and `ghost` are now authoritatively defined by this section. This supersedes the prior statement in this document that active/pressed states were intentionally not added — this revision adds them for exactly these three variants, plus `destructive`, below.

#### 5.4.1 Shared focus state

Focus styling is identical across all four action variants and is defined by two binding semantic non-color values, alongside the existing `action.disabled.opacity` contract (Section 5.4.2):

- `focus.ring.width = 2px` (future CSS custom property: `--focus-ring-width`)
- `focus.ring.offset = 2px` (future CSS custom property: `--focus-ring-offset`)

Button focus is:

- Expressed through `:focus-visible` only, never on every pointer-driven focus event.
- An **external** outline, drawn outside the component's visible boundary — not inset, and not overlapping the component's own fill.
- Sized by `focus.ring.width` and separated from the component by `focus.ring.offset`.
- Colored by `color.border.focus` (see Section 5.3), never a variant-specific focus color.
- Never a replacement for a variant's background, foreground, or border mapping — it is an additional, external ring, layered outside whichever state (default, hover, or active) the control is already in.
- Not transitioned and not animated via `box-shadow` — consistent with `Animations.md` §6, which restricts animation to `transform`/`opacity` and explicitly prohibits animating `box-shadow`.

**Accessibility boundary.** Because the indicator is explicitly external and separated from the component by `focus.ring.offset`, its required adjacent-color contrast is evaluated against the surface the Button appears on, not against every Button fill the ring happens to sit near. `color.border.focus` (`#3A63F5`) is verified below against every surface currently authorized to host a Button:

| Adjacent surface        | Value                                              |    Ratio | Requirement | Result |
| ----------------------- | -------------------------------------------------- | -------: | ----------- | ------ |
| `color.surface.canvas`  | `#FAFAFC`                                          | `4.70:1` | `3:1`       | Pass   |
| `color.surface.subtle`  | `#F5F6FA`                                          | `4.54:1` | `3:1`       | Pass   |
| `color.surface.raised`  | `#FAFAFC` (identical to `canvas`, see Section 5.1) | `4.70:1` | `3:1`       | Pass   |
| `color.surface.inverse` | `#0F0F1A`                                          | `3.88:1` | `3:1`       | Pass   |

`color.surface.overlay` is not tested here: it is a translucent scrim rendered behind other content (Section 5.1), not a surface a Button's own edge is placed directly against, so it is not an "adjacent surface" in the sense this contrast rule governs.

#### 5.4.2 Disabled treatment

A single shared semantic value governs disabled styling across all four variants:

- `action.disabled.opacity = 0.5`
- Future CSS custom property: `--opacity-action-disabled`

This is a semantic **opacity** value, not a color token — it is tracked separately from, and does not count toward, the 39 semantic color tokens declared in Section 3. Disabled treatment:

- Retains the base variant's own background, foreground, and border color mapping (no separate disabled color token exists, or is needed, per variant).
- Applies `action.disabled.opacity` on top of that base mapping.
- Suppresses hover and active treatment — a disabled control never transitions to its hover or active fill.
- Uses the native HTML `disabled` attribute as the effective mechanism, not a visual-only convention.
- Is non-interactive.
- Uses a `not-allowed` cursor wherever a `pointer` cursor would otherwise apply.
- Is not animated.

No separate disabled color token is created for `primary`, `secondary`, `ghost`, or `destructive` individually — `action.disabled.opacity` applies uniformly to whichever variant's own colors are already in use.

#### 5.4.3 Loading treatment

Loading uses exactly the same visual color and opacity treatment as disabled (Section 5.4.2). It does not introduce a new color token, a distinct loading color, a spinner, a loading-icon token, or a loading animation.

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

| Pair                                                                      |     Ratio | Requirement                                        | Result               |
| ------------------------------------------------------------------------- | --------: | -------------------------------------------------- | -------------------- |
| Text primary on canvas                                                    | `18.25:1` | `4.5:1`                                            | Pass                 |
| Text secondary on canvas                                                  |  `9.89:1` | `4.5:1`                                            | Pass                 |
| Text muted on canvas                                                      |  `7.25:1` | `4.5:1`                                            | Pass                 |
| Text inverse on inverse surface                                           | `18.25:1` | `4.5:1`                                            | Pass                 |
| Text disabled on canvas                                                   |  `2.46:1` | Not applicable — disabled content, see Section 5.2 | Documented exception |
| Link on canvas                                                            |  `6.68:1` | `4.5:1`                                            | Pass                 |
| Primary-action foreground on background                                   |  `9.02:1` | `4.5:1`                                            | Pass                 |
| Primary-action foreground on hover background                             | `11.10:1` | `4.5:1`                                            | Pass                 |
| Primary-action foreground on active background                            | `12.76:1` | `4.5:1`                                            | Pass                 |
| Secondary-action foreground on background                                 | `18.25:1` | `4.5:1`                                            | Pass                 |
| Secondary-action foreground on hover background                           | `16.39:1` | `4.5:1`                                            | Pass                 |
| Secondary-action foreground on active background                          | `14.41:1` | `4.5:1`                                            | Pass                 |
| Secondary-action outlined boundary (`border.strong` vs. canvas)           |  `4.64:1` | `3:1`                                              | Pass                 |
| Secondary-action outlined boundary (`border.strong` vs. `surface.subtle`) |  `4.48:1` | `3:1`                                              | Pass                 |
| Ghost-action foreground on canvas                                         |  `6.68:1` | `4.5:1`                                            | Pass                 |
| Ghost-action foreground on hover background                               |  `6.00:1` | `4.5:1`                                            | Pass                 |
| Ghost-action foreground on active background                              |  `5.27:1` | `4.5:1`                                            | Pass                 |
| Destructive-action foreground on background                               |  `4.63:1` | `4.5:1`                                            | Pass                 |
| Destructive-action foreground on hover background                         |  `6.21:1` | `4.5:1`                                            | Pass                 |
| Destructive-action foreground on active background                        |  `7.97:1` | `4.5:1`                                            | Pass                 |
| Focus indicator vs. canvas                                                |  `4.70:1` | `3:1`                                              | Pass                 |
| Focus indicator vs. inverse surface                                       |  `3.88:1` | `3:1`                                              | Pass                 |
| Status success foreground/background                                      |  `6.81:1` | `4.5:1`                                            | Pass                 |
| Status warning foreground/background                                      |  `6.84:1` | `4.5:1`                                            | Pass                 |
| Status error foreground/background                                        |  `7.60:1` | `4.5:1`                                            | Pass                 |
| Status info foreground/background                                         |  `8.01:1` | `4.5:1`                                            | Pass                 |

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
