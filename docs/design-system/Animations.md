# FIKRA Motion System

**Doc ID:** UI-07<br>
**Status:** Foundation v1<br>
**Depends on:** UI-01 and success/loading UX rules<br>
**Referenced by:** UI-02

## 1. Routine motion budget — binding

| Interaction class | Duration | Easing |
|---|---:|---|
| Micro: hover, focus, toggle, compact feedback | `100–150ms` | ease-out |
| Standard: panel, sheet, tab, menu | `200–250ms` | ease-in-out |
| Content transition: route or studio context | `200–250ms` | ease-in-out |

**UI-RULE-2:** Routine product animation may not exceed `250ms`.

## 2. Designated reveal and celebration moments

Only two journey moments may use staged motion lasting `400–600ms`:

1. First meaningful draft reveal.
2. Final approval or delivery celebration.

Each journey receives at most one celebration treatment. These exceptions must be purposeful, finite, non-blocking, and replaceable by a static cue.

## 3. Marketing Hero visual exception

The public marketing homepage may contain **one** decorative interactive visual scene in the Hero. It may run longer than the routine duration cap because it is a bounded scene rather than a UI state transition.

This exception is valid only when all conditions are met:

- It appears only on the public marketing Hero, never in the authenticated workspace.
- Essential headline, explanation, and CTAs render immediately and do not wait for it.
- It carries no unique information and is never required to understand or operate the page.
- It has a static `prefers-reduced-motion` version.
- It is simplified or replaced on mobile and constrained devices.
- It pauses when the Hero is outside the viewport or the page is not visible.
- It does not capture scrolling, depend on pointer tracking, or block keyboard/touch use.
- It stays within an approved performance budget and is measured before release.

This exception does not permit decorative `animate-float`, pulse, or ambient animation elsewhere.

## 4. Generation-in-progress motion

- An indeterminate spinner is not used beyond the short loading tier of three seconds.
- Longer AI work displays real partial results, real status text, or a stage tracker.
- Decorative pulsing on static marketing cards does not qualify as generation progress.
- Partial population must avoid misleading completion signals.

## 5. Reduced motion

Every animation has an explicit `prefers-reduced-motion` behavior:

- Micro and standard transitions become instant or nearly instant state changes.
- Reveal sequences show all results together with a static highlight.
- The Hero scene becomes a static visual composition.

Reduced motion must preserve state clarity and must never remove content.

## 6. Performance constraints

- Animate `transform` and `opacity` only.
- Do not animate layout properties such as width, height, top, left, margins, or padding.
- Do not animate `box-shadow`; use opacity on a prepared visual layer if a soft elevation transition is essential.
- Stop off-screen decorative rendering.
- Avoid continuous timers for workspace UI.
- Validate on representative mobile hardware, not desktop only.

## 7. Review-blocking violations

- Routine duration above `250ms`.
- Hover, focus, or toggle motion above `150ms`.
- Undocumented ambient animation.
- Motion without a reduced-motion equivalent.
- Motion that carries essential meaning or delays a primary action.
- Decorative progress indicators that do not represent real progress.
