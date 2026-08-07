# FIKRA Grid, Spacing, Radius, and Layout System

**Doc ID:** UI-06<br>
**Status:** Foundation v1<br>
**Depends on:** UI-01 and responsive UX requirements<br>
**Referenced by:** UI-02

## 1. Base spacing tokens

FIKRA uses a `4px` base unit. The approved v1 spacing scale is:

| Token | Value |
|---|---:|
| `space.1` | `4px` |
| `space.2` | `8px` |
| `space.3` | `12px` |
| `space.4` | `16px` |
| `space.6` | `24px` |
| `space.8` | `32px` |
| `space.12` | `48px` |
| `space.16` | `64px` |

Components may not use arbitrary spacing values or valid-but-off-scale utilities such as a `96px` padding. A new spacing token requires a documented layout need.

## 2. Radius tokens

Radius is its own token family; it is not inferred from the spacing scale.

| Token | Value | Intended use |
|---|---:|---|
| `radius.none` | `0` | Flush structural regions |
| `radius.sm` | `8px` | Small controls and badges |
| `radius.md` | `12px` | Inputs, buttons, compact cards |
| `radius.lg` | `16px` | Standard cards, sheets |
| `radius.xl` | `24px` | Marketing panels and prominent media |
| `radius.full` | `9999px` | Pills and circular controls only |

Arbitrary values such as `rounded-[2rem]` are prohibited in components even when they happen to resemble an approved value.

## 3. Responsive layout grid

| Breakpoint | Columns | Gutter | Inline margin |
|---|---:|---:|---:|
| Mobile `320–767px` | 4 | `16px` | `16px` |
| Tablet `768–1023px` | 8 | `24px` | `24px` |
| Desktop `1024px+` | 12 | `24px` | `32px` |

Desktop content is centered and capped at `1440px`. Full-bleed marketing backgrounds may span the viewport, but their readable content aligns to the grid.

## 4. Authenticated app shell

On desktop RTL:

- Primary navigation sidebar: `240px`, fixed at the right edge.
- Main canvas: fluid and centered, using the 12-column content grid.
- Supporting/context panel: `360px`, collapsible at the left edge.

At tablet width, the sidebar becomes a `64px` icon rail and the supporting panel becomes an overlay. On mobile, primary navigation becomes the approved four-item bottom navigation and supporting panels use sheets.

DOM order, grid areas, focus order, and visual order must remain understandable. Do not assume CSS Grid line numbers automatically become inline-relative under `dir="rtl"`; app-shell placement must be explicit and visually tested.

### 4.1 Implementation contract — binding

The phrases "right edge" and "left edge" above describe the required visual outcome in the default RTL interface, not the CSS implementation technique.

- In RTL, primary navigation occupies `inline-start` — visually the right side.
- The supporting/context panel occupies `inline-end` — visually the left side.
- Implement placement through named grid regions and direction-aware logical mapping.
- Do not implement this contract using physical utilities or properties such as `right: 0`, `left: 0`, `border-l`, `border-r`, `ml-*`, `mr-*`, `pl-*`, or `pr-*`.
- Any future LTR support must use an explicit direction-aware layout mapping rather than changing DOM order or duplicating navigation semantics.

This clarification preserves the required RTL visual outcome above and the accessibility requirements for DOM order, reading order, and focus order; it does not change them.

## 5. Studio canvas

Multi-option outputs use:

- 1 column on mobile.
- 2 columns on tablet.
- Up to 3 columns on desktop.

Never exceed three comparison columns. Partial results must preserve stable positions without layout jumps that obscure which option changed.

## 6. Marketing layout

- Hero may be full viewport in presentation, but essential text and actions stay inside the content grid.
- Arabic text measure must remain readable; oversized headlines may wrap intentionally but must not collide with the hero visual.
- Full-bleed horizontal statements are allowed as section transitions, with a non-animated fallback on mobile and reduced-motion settings.
- Pointer-led layouts must have touch, keyboard, and static alternatives.

## 7. RTL rules

- Use logical properties: inline/block start and end.
- Avoid physical direction utilities where direction matters: `left`, `right`, `ml-*`, `mr-*`, `pl-*`, `pr-*`, `border-l`, and `border-r`.
- Directional icons must mirror only when their meaning is directional; final rules belong to pending UI-05.
- Test Arabic wrapping, mixed Arabic/Latin text, numbers, currency, menus, sheets, toasts, and the complete app shell.
