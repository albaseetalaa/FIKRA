# FIKRA Component System

**Doc ID:** UI-02<br>
**Status:** v1 component contract<br>
**Depends on:** UI-01, UI-03, UI-06, UI-07; UI-04 typography and UI-05 icons are pending<br>
**Referenced by:** Frontend architecture and implementation backlog

## 1. Component rules

- Components consume semantic tokens exclusively.
- Components must be RTL-safe by construction and verified visually.
- Variants are constrained and documented before implementation.
- Marketing compositions do not create casual workspace component variants.
- No new font or icon dependency is introduced until UI-04 and UI-05 are approved.

## 2. Core workspace components

| Component                | Purpose                           | Required states                                  | Constrained variants                                        |
| ------------------------ | --------------------------------- | ------------------------------------------------ | ----------------------------------------------------------- |
| Button                   | Primary action trigger            | default, hover, active, focus, disabled, loading | primary, secondary, ghost, destructive                      |
| Input / Textarea         | Forms and AI Chat input           | default, focus, error, disabled, filled          | text, number, currency; locale and workspace currency aware |
| Card                     | Options, files, projects          | default, selected, hover, focus                  | flat, elevated                                              |
| Modal / Sheet            | Confirmation and focused tasks    | entering, open, exiting                          | modal on desktop, sheet on mobile                           |
| Toast                    | Non-blocking status               | entering, visible, exiting                       | success, info, error                                        |
| Progress / Status        | Generation and pipeline progress  | queued, active, complete, failed                 | skeleton, streaming content, stage tracker                  |
| Nav Sidebar              | Desktop/tablet primary navigation | expanded, collapsed, active                      | one responsive component                                    |
| Bottom Nav               | Mobile primary navigation         | default, active                                  | exactly four items                                          |
| Chat Bubble / Panel      | Guided AI work                    | user, AI, generating, brief card                 | four documented states                                      |
| Comparison Grid          | Multi-option studio output        | 1–5 items, loading per item, partial failure     | responsive only                                             |
| File / Asset Card        | Draft and delivered assets        | draft, final, delivered                          | content-defined type/format badge                           |
| Empty State              | Recovery from an empty surface    | default                                          | exactly one primary action                                  |
| Price / Checkout Summary | Transparent purchase summary      | itemized, add-ons, final                         | final price present at mount                                |

Action-required notifications belong in the Notification Center, not a toast. Generation lasting beyond the short loading tier must show real partial progress or status, not an indefinite spinner.

## 3. Marketing-only compositions

These are documented patterns assembled from tokens and primitives; they do not automatically become workspace variants:

- Cinematic Hero.
- Studio Showcase.
- Guided Journey Steps.
- Trust / Quality Proof.
- Intelligent Agent Roster.
- Final Conversion CTA.

The Cinematic Hero may host the single motion exception defined in UI-07. All other marketing interactions use the routine motion budget.

## 4. App-shell contract

- The desktop RTL sidebar is visually on the right.
- The contextual panel, when present, is visually on the left.
- Main content remains first-class in focus and reading order.
- Tablet and mobile transformations follow UI-06 without duplicating navigation semantics.
- App-shell components do not depend on dark mode in v1.

## 5. Acceptance criteria for every component PR

- [ ] Uses semantic tokens only; no raw or arbitrary values.
- [ ] Fits the documented variant set.
- [ ] RTL and mixed-content behavior visually tested.
- [ ] Keyboard-operable, screen-reader labeled, and visibly focused.
- [ ] Meets contrast requirements in every state.
- [ ] Motion complies with UI-07 and has a reduced-motion behavior.
- [ ] Responsive behavior verified at mobile, tablet, and desktop ranges.
- [ ] Business logic and product states remain unchanged unless the PR explicitly covers them.
- [ ] Component documentation is updated before merge.

## 6. Button — binding v1 contract

This section completes the Button row in Section 2. The constrained variant list — **primary, secondary, ghost, destructive** — and the required-state list — **default, hover, active, focus, disabled, loading** — are unchanged from Section 2 and are not redefined here. Color values for every state and variant are defined in `Colors.md` §5.4.

### 6.1 Native/API boundary

- The foundation component renders a native `<button>` only.
- Default variant is `primary`.
- Default native `type` is `button`.
- Explicit native types such as `submit` remain supported and must be preserved when set by the caller.
- No `size` prop or size scale.
- No `asChild` behavior.
- No polymorphism.
- No `href` prop.
- No icon-specific public prop.
- Button-styled links (e.g. a CTA currently implemented as a styled `Link`) remain a later, separate documented decision and are out of scope for the foundation component.

### 6.2 Default geometry

One default configuration is authorized; no size variant is introduced:

| Property           | Value                 |
| ------------------ | --------------------- |
| Display            | `inline-flex`         |
| Minimum height     | `space.12` = `48px`   |
| Inline padding     | `space.6` = `24px`    |
| Content gap        | `space.2` = `8px`     |
| Alignment          | Centered on both axes |
| Radius             | `radius.md` = `12px`  |
| Default full-width | Off                   |

Full width may be requested by the caller through normal layout/class composition (e.g. a wrapping `w-full` utility); it is not a Button variant and does not require a new prop.

### 6.3 Typography

Until UI-04 (Arabic type system) is completed, Button authorizes the existing framework conventions already used across the repository, as a temporary measure:

- `text-sm`
- `font-semibold`
- Tailwind's paired default line height for `text-sm`
- Existing global font-family inheritance (no new font dependency, per Section 1)

These are approved temporary framework conventions, not a newly invented public size variant. UI-04 may later replace their internal implementation without changing the Button API.

### 6.4 Focus

Full binding definition: `Colors.md` §5.4.1. Summary:

- Focus is expressed only through `:focus-visible`, never on every pointer-driven focus event.
- The focus ring is an **external** outline outside the component's visible boundary — not inset — sized by `focus.ring.width` (`2px`) and separated from the component by `focus.ring.offset` (`2px`), colored by `color.border.focus`.
- No variant-specific focus color exists — focus styling is identical across primary, secondary, ghost, and destructive.
- Focus never replaces a variant's background, foreground, or border mapping.
- Focus is not transitioned and is not animated via `box-shadow`.
- Because the ring is external and offset, its required adjacent-color contrast is against the surface the Button appears on, not against every Button fill — verified for every currently authorized surface in `Colors.md` §5.4.1.

### 6.5 Disabled

Explicit `disabled` is the only Button state that uses native disabled semantics:

- `disabled` is set via the native HTML `disabled` attribute.
- The native `disabled` attribute makes the Button non-interactive and removes it from sequential keyboard focus, per native browser behavior.
- Native disabled semantics remain recognizable by assistive technology on their own; no redundant `aria-disabled` attribute is required for this explicit native disabled state.
- Disabled suppresses hover and active styling for the active variant.
- Disabled uses `action.disabled.opacity` (`Colors.md` §5.4.2).
- No motion is applied when entering or leaving the disabled state.

### 6.6 Loading

`loading` is a distinct pending state from explicit `disabled` (Section 6.5) and does not reuse its interaction mechanism. This binding contract corrects the native-`disabled`-based pattern currently used by `LoginForm`, `SignupForm`, and `WizardNavigation` (each sets the native `disabled` attribute plus `aria-busy` on their pending/submitting state); migrating those call sites to this contract is a later, separate implementation task and is out of scope for this documentation revision.

- `loading={true}` alone does not set the native HTML `disabled` attribute on an otherwise enabled Button.
- `loading={true}` sets `aria-disabled="true"` and `aria-busy="true"`.
- The Button remains in the accessibility tree and in sequential keyboard focus order while loading.
- If the Button already held focus when it initiated the operation, loading must preserve that focus.
- `aria-disabled` alone does not suppress native browser interaction. While loading, the Button foundation must programmatically suppress every user activation path: pointer activation, `Enter`/`Space` key activation, the caller's `onClick`, and default form-submit activation.
- If `disabled={true}` and `loading={true}` are both set, the native `disabled` attribute remains authoritative for interaction and focus; `aria-busy` continues to reflect the pending operation.
- Visual color and opacity treatment during loading is identical to disabled (`Colors.md` §5.4.2–§5.4.3); only the interaction mechanism above differs.
- The caller owns the localized, visible label change (for example, changing "Log in" to "Signing in…"); the Button does not invent or supply loading copy.
- `aria-busy` is not a guaranteed loading announcement on its own. A consumer using `loading` must provide a stable, localized status announcement via `role="status"` (or equivalent `aria-live="polite"` treatment); the status region must already exist in the DOM before the loading text is inserted so the update is reliably announced. Consumer migration to this contract must preserve or add this announcement.
- The Button does not render a spinner.
- The Button does not expose a loading-indicator slot or prop.
- Loading introduces no motion and no icon dependency, consistent with UI-05 remaining pending.

### 6.7 Motion

Button state-color changes (hover, active, focus, disabled, loading) are immediate in the foundation component — no transition is authorized or required. `transition-all`, color animation, `box-shadow` animation, and undocumented transforms are not authorized, consistent with `Animations.md` §6's restriction to `transform`/`opacity` only and its prohibition on animating `box-shadow`. Motion compliance in the Section 5 acceptance checklist is satisfied because no motion is introduced.
