# FIKRA Design System

**Doc ID:** UI-01<br>
**Status:** Foundation v1 — binding structure; visual identity values remain provisional<br>
**Depends on:** Product philosophy and UX Blueprint<br>
**Referenced by:** UI-02–UI-07 and all frontend work

## 1. Purpose

The FIKRA Design System makes the product beautiful by default, fast by default, Arabic-first, and deliberately constrained. It governs both the public marketing experience and the authenticated application without forcing both surfaces to have the same visual density or motion level.

## 2. Product principles translated into rules

| Product principle | Binding design-system expression |
|---|---|
| Beautiful by default | Every approved component ships with production-ready defaults. |
| Fast by default | Fonts must not block rendering; routine motion is capped by UI-07; decorative effects must not delay content or input. |
| Arabic first, not translated | `lang="ar"` and `dir="rtl"` are the root defaults. Layout is authored with logical properties and visually tested in RTL. |
| Simplicity over complexity | Components have a constrained, documented variant set. Ad hoc feature variants are not permitted. |
| Human-trusted production | Status, approval, revision, expert-review, and delivered-file states remain explicit and legible. |

## 3. Two-surface experience model

FIKRA has two related but intentionally different experience surfaces:

### 3.1 Public marketing site

- Premium, cinematic, confident, and visually expressive.
- Uses short Arabic headlines, strong composition, and one optional hero visual scene.
- May use full-bleed sections and marketing-specific compositions.
- Must remain accessible, responsive, and fast; visual effects never carry essential meaning.

### 3.2 Authenticated workspace

- Calm, clear, responsive, and task-oriented.
- The Workspace is the persistent home; AI Chat is the guided entry point to Studios.
- Studios, Brand Memory, files, experts, and tasks prioritize comprehension and repeat daily use.
- No ambient decorative motion. One primary action per screen wherever the UX rule applies.

The marketing surface may be expressive; the workspace must never inherit cinematic effects that reduce speed or clarity.

## 4. System architecture

1. **Primitive token layer** — raw color and numeric values are defined only here.
2. **Semantic token layer** — purpose-based aliases such as surfaces, text, borders, actions, and statuses.
3. **Component layer** — consumes semantic tokens only; never primitive palette steps or raw values.
4. **Pattern layer** — documented compositions such as the app shell, studio canvas, comparison flow, and marketing hero.

For Tailwind CSS 4, implementation tokens will be exposed centrally through `@theme` in `src/app/globals.css`. Components must not introduce raw `hex`, `rgb`, `rgba`, arbitrary bracket values, or arbitrary pixel/rem values.

**UI-RULE-1:** If a required value does not exist, add a named token with a documented rationale before using it. Do not bypass the token layer inside a component.

## 5. Identity direction — not final identity

- Positioning: **premium but approachable — Figma professionalism with Canva warmth**.
- Avoid toy-like playfulness and cold corporate sterility.
- The Arabic and Latin wordmarks must each be independently balanced.
- The current palette values are placeholders, not approved brand colors.
- The Arabic type system (UI-04) is pending; do not select or install a font yet.
- The icon system (UI-05) is pending; do not install an icon library yet.
- Dark mode is not part of v1.

## 6. Direction and accessibility

- RTL is the default authored and tested state, not an optional variant.
- Use logical properties and direction-safe utilities whenever direction matters.
- Do not encode meaning by color, motion, hover, or pointer position alone.
- All interactive elements must be keyboard-operable, screen-reader labeled, and visibly focused.
- Text and controls must meet the contrast requirements in UI-03.
- Motion must follow UI-07 and `prefers-reduced-motion`.

## 7. Governance

- Every new token or component variant requires a documented purpose and design-owner approval.
- Breaking component changes require a deprecation cycle of at least one release.
- Raw values, undocumented variants, untested RTL behavior, and motion-budget violations block review.
- Generated customer brand content is visually separate from FIKRA application chrome and is not allowed to redefine product UI tokens.

## 8. v1 non-goals

- Final brand palette.
- Final Arabic typography specification.
- Final icon system.
- Dark mode.
- Cinematic motion inside the authenticated workspace.
