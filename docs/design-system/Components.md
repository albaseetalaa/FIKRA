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

| Component | Purpose | Required states | Constrained variants |
|---|---|---|---|
| Button | Primary action trigger | default, hover, active, focus, disabled, loading | primary, secondary, ghost, destructive |
| Input / Textarea | Forms and AI Chat input | default, focus, error, disabled, filled | text, number, currency; locale and workspace currency aware |
| Card | Options, files, projects | default, selected, hover, focus | flat, elevated |
| Modal / Sheet | Confirmation and focused tasks | entering, open, exiting | modal on desktop, sheet on mobile |
| Toast | Non-blocking status | entering, visible, exiting | success, info, error |
| Progress / Status | Generation and pipeline progress | queued, active, complete, failed | skeleton, streaming content, stage tracker |
| Nav Sidebar | Desktop/tablet primary navigation | expanded, collapsed, active | one responsive component |
| Bottom Nav | Mobile primary navigation | default, active | exactly four items |
| Chat Bubble / Panel | Guided AI work | user, AI, generating, brief card | four documented states |
| Comparison Grid | Multi-option studio output | 1–5 items, loading per item, partial failure | responsive only |
| File / Asset Card | Draft and delivered assets | draft, final, delivered | content-defined type/format badge |
| Empty State | Recovery from an empty surface | default | exactly one primary action |
| Price / Checkout Summary | Transparent purchase summary | itemized, add-ons, final | final price present at mount |

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
