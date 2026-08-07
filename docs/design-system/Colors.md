# FIKRA Color System

**Doc ID:** UI-03<br>
**Status:** Token architecture binding; literal palette values provisional<br>
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

Components use only these purpose-based aliases. Direct use of `primary-*`, `accent-*`, `neutral-*`, `slate-*`, `brand-*`, or other palette steps in a component is a design-system violation.

## 4. Placeholder anchors — not brand approval

| Primitive anchor | Placeholder | Purpose of placeholder |
|---|---:|---|
| `color.primitive.primary.500` | `#1A1A2E` | Temporary deep-indigo anchor |
| `color.primitive.accent.500` | `#E94560` | Temporary warm accent anchor |
| `color.primitive.neutral.950` | `#0F0F1A` | Temporary darkest neutral |
| `color.primitive.neutral.0` | `#FAFAFC` | Temporary lightest neutral |
| `color.primitive.green.600` | `#16A34A` | Temporary success anchor |
| `color.primitive.red.600` | `#DC2626` | Temporary error anchor |
| `color.primitive.green.50` | `#F0FDF4` | Temporary success background anchor |
| `color.primitive.green.800` | `#166534` | Temporary success foreground anchor |
| `color.primitive.amber.50` | `#FFFBEB` | Temporary warning background anchor |
| `color.primitive.amber.800` | `#92400E` | Temporary warning foreground anchor |
| `color.primitive.red.50` | `#FEF2F2` | Temporary error background anchor |
| `color.primitive.red.800` | `#991B1B` | Temporary error foreground anchor |
| `color.primitive.blue.50` | `#EFF6FF` | Temporary info background anchor |
| `color.primitive.blue.800` | `#1E40AF` | Temporary info foreground anchor |

These anchors are implementation placeholders only. They must not be presented as the final FIKRA identity, and the full accessible scales must be generated and reviewed before production use.

### 4.1 Status semantic mappings — provisional

```text
color.status.success.background → color.primitive.green.50
color.status.success.foreground → color.primitive.green.800
color.status.warning.background → color.primitive.amber.50
color.status.warning.foreground → color.primitive.amber.800
color.status.error.background   → color.primitive.red.50
color.status.error.foreground   → color.primitive.red.800
color.status.info.background    → color.primitive.blue.50
color.status.info.foreground    → color.primitive.blue.800
```

- These mappings are implementation placeholders and do not constitute approval of the final FIKRA palette.
- Components still consume only the semantic tokens in Section 3 — never `color.primitive.*` directly.
- Each foreground/background pair above must be contrast-tested in its real component context, per Section 5, before implementation approval.

## 5. Contrast rules

- Normal text: minimum `4.5:1` contrast.
- Large text and essential non-text UI: minimum `3:1` where WCAG permits.
- Focus indicators and meaningful state boundaries: minimum `3:1` against adjacent colors.
- Statuses must pair color with text, iconography, or another non-color cue.
- Every semantic foreground/background pair must be tested in its real component context.

Generated customer brand content is not application chrome and may use the customer's palette. Studios must still analyze that content, flag accessibility failures, and avoid allowing customer colors to leak into FIKRA navigation or controls.

## 6. Dark mode

Dark mode is not committed for v1. The token architecture must remain theme-ready, but no v1 component may introduce or depend on `dark:` behavior. Existing `dark:` classes are audit findings to be handled in an approved implementation task, not silently changed during documentation work.

## 7. Implementation acceptance criteria

- All aliases resolve centrally through the token layer.
- No raw colors appear in components.
- No component consumes a primitive palette step directly.
- Contrast tests cover default, hover, active, disabled, focus, error, and selected states.
- Final brand palette replacement requires no component API changes.
