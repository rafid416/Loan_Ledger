# DRD: In-Memory Loan Ledger UI
**Version:** v1  
**Date:** 2026-06-22  
**Source:** prd-loan-ledger-v1.md + clarifying session  

---

## Standards Compliance

| Field | Value |
|-------|-------|
| Standards version | 1.0.0 |
| Standards applied | global/principles.md, global/accessibility.md, domains/design-ui.md, phases/create-drd.md |
| Design system | Shadcn UI + Tailwind CSS, Linear-style dark mode aesthetic |
| Deviations | Light/dark toggle added (design standard specifies dark-first but does not prohibit a toggle). Desktop-only layout for v1 — DRD-4 breakpoints standard noted but mobile is NG-7 in the PRD. |

---

## 1. Overview

A single-page financial ledger UI for modeling a mortgage loan as an event-sourced ledger. The design must make complex financial data scannable and trustworthy — clarity and correctness of presentation over visual decoration.

**Design objective:** Give the ledger table maximum screen real estate while keeping loan setup and event entry always accessible via a collapsible left sidebar.

---

## 2. Goals

- DG-1: Make the ledger table the dominant visual element — it is the primary output evaluators will scrutinize
- DG-2: Allow the left panel to collapse to a 64px icon rail so the ledger can use maximum horizontal space
- DG-3: Surface the four key summary figures (balance, accrued interest, next payment, payoff-today) as scannable stat cards above the ledger
- DG-4: Visually distinguish reversed payments (struck-through, muted) from active payments at a glance
- DG-5: Support light and dark mode with a toggle; dark mode as default
- DG-6: Meet WCAG 2.1 Level AA accessibility requirements

---

## 3. User Context

**Who:** A loan officer, developer, or evaluator testing the app. Technically comfortable, expects financial data to be precise and clearly labeled.

**Context of use:** Desktop browser, single session, no persistence. The user creates a loan, posts events, and watches the ledger update in real time. They may collapse the sidebar to focus on the ledger when reviewing transactions.

**Primary workflow:**
1. Open app → see empty state with Loan Setup form in left panel
2. Fill in loan terms → create loan → ledger shows funding row
3. Add events via left panel → ledger updates after each submission
4. Collapse sidebar → review ledger with full screen width
5. Click a ledger row to pre-fill reversal form → expand sidebar → submit

---

## 4. Layout

### 4.1 Overall Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  App Header: "Loan Ledger"  [Day-Count Toggle]  [Light/Dark Toggle] │
├──────────────────┬──────────────────────────────────────────────────┤
│                  │  Stat Cards Row                                  │
│   Left Panel     │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────┐ │
│   (collapsible)  │  │ Balance  │ │ Accrued  │ │  Next    │ │Pay-│ │
│                  │  │          │ │ Interest │ │ Payment  │ │off │ │
│   ┌────────────┐ │  └──────────┘ └──────────┘ └──────────┘ └────┘ │
│   │ Loan Setup │ ├──────────────────────────────────────────────────┤
│   │ (accordion)│ │                                                  │
│   ├────────────┤ │   Ledger Table (scrollable)                      │
│   │ Add Event  │ │                                                  │
│   │ (accordion)│ │                                                  │
│   └────────────┘ │                                                  │
│                  │                                                  │
│  [◀ Collapse]    │                                                  │
└──────────────────┴──────────────────────────────────────────────────┘
```

### 4.2 Collapsed Sidebar State

```
┌────┬────────────────────────────────────────────────────────────────┐
│ ⚙  │  Stat Cards Row                                               │
│    ├────────────────────────────────────────────────────────────────┤
│ +  │                                                                │
│    │   Ledger Table (maximum width)                                 │
│ ▶  │                                                                │
└────┴────────────────────────────────────────────────────────────────┘
  64px
```

Collapsed icon rail shows: settings icon (Loan Setup), plus icon (Add Event), expand arrow.

### 4.3 Left Panel Dimensions

| State | Width | Behavior |
|-------|-------|----------|
| Expanded | 280px | Fixed, not resizable |
| Collapsed | 64px | Icon rail only |
| Transition | 200ms ease-out | Smooth collapse/expand |

### 4.4 Accordion Sections in Left Panel

Both **Loan Setup** and **Add Event** are accordion sections — one can be open at a time. Clicking the header expands it and collapses the other. This keeps the left panel compact when only one form is needed.

---

## 5. Visual Requirements

### 5.1 Color Tokens

**Dark Mode (default):**

| Token | Hex | Use |
|-------|-----|-----|
| bg-base | #0A0A0B | Page background |
| bg-surface | #111113 | Cards, left panel, table |
| bg-elevated | #18181B | Accordion headers, stat cards |
| bg-hover | #1F1F23 | Table row hover |
| bg-active | #27272A | Selected/active states |
| text-primary | #FAFAFA | Primary text, numbers |
| text-secondary | #A1A1AA | Labels, column headers |
| text-tertiary | #71717A | Placeholder, disabled |
| text-muted | #52525B | Timestamps, hints |
| accent-primary | #6366F1 | Primary buttons, focus rings |
| accent-success | #22C55E | Positive amounts, funded |
| accent-warning | #F59E0B | Advance events |
| accent-error | #EF4444 | Reversal rows, NSF badge |
| border-subtle | #27272A | Dividers |
| border-default | #3F3F46 | Card borders |
| border-focus | #6366F1 | Focus rings |

**Light Mode:**

| Token | Value | Use |
|-------|-------|-----|
| bg-base | #FFFFFF | Page background |
| bg-surface | #F4F4F5 | Cards, panels |
| bg-elevated | #E4E4E7 | Accordion headers |
| bg-hover | #F1F1F3 | Table row hover |
| text-primary | #09090B | Primary text |
| text-secondary | #52525B | Labels |
| text-tertiary | #A1A1AA | Placeholder |
| accent-primary | #6366F1 | Unchanged |
| border-subtle | #E4E4E7 | Dividers |
| border-default | #D4D4D8 | Borders |

### 5.2 Typography

Using Inter (system-ui fallback). All via Tailwind classes:

| Element | Size | Weight | Token |
|---------|------|--------|-------|
| App title | 20px | 600 | heading-1 |
| Panel section headers | 13px | 600 | caption-bold |
| Form labels | 13px | 500 | body-small |
| Input text | 14px | 500 | body |
| Table column headers | 12px | 500 uppercase | caption |
| Table cell text | 13px | 500 | body-small |
| Stat card label | 12px | 500 | caption |
| Stat card value | 22px | 600 | heading-2 |
| Monospace (IDs, amounts) | 13px | 500 | mono (font-mono) |

### 5.3 Spacing

4px base unit. All spacing via Tailwind:

| Use | Value |
|-----|-------|
| Left panel padding | 16px (p-4) |
| Accordion section padding | 16px (p-4) |
| Stat card padding | 16px (p-4) |
| Table cell padding | 12px horizontal, 10px vertical |
| Form field gap | 12px (gap-3) |
| Section gap | 24px (gap-6) |

### 5.4 Border Radius

| Element | Radius |
|---------|--------|
| Buttons | 6px (rounded-md) |
| Inputs | 6px (rounded-md) |
| Stat cards | 8px (rounded-lg) |
| Left panel | 0px (full height edge) |
| Badges/tags | 4px (rounded) |

---

## 6. Component Specifications

### 6.1 App Header

- Full width, height 48px
- bg-surface, 1px border-bottom border-subtle
- Left: app title "Loan Ledger" in heading-1
- Right: Day-Count toggle (Actual/365 | 30/360) + Light/Dark toggle
- Sticky — stays at top on scroll

### 6.2 Left Panel — Loan Setup Accordion

**Header:** "Loan Setup" label + chevron icon, 40px height, bg-elevated  
**Expanded content — form fields:**

| Field | Input Type | Notes |
|-------|-----------|-------|
| Principal | Number input | Prefix: $ symbol |
| Annual Rate (%) | Number input | Suffix: % symbol, 2 decimal places |
| Amortization (years) | Number input | Integer only |
| Payment Frequency | Select | Monthly only for v1 (disabled/locked) |
| Start Date | Date picker | ISO date |

- **Create Loan** button: full width, accent-primary, "Create Loan"
- **Reset** button: full width, ghost/danger variant, "Reset Loan" — shown only after loan is created
- Calculated monthly payment shown below buttons: `Monthly Payment: $1,493.56` in text-secondary

### 6.3 Left Panel — Add Event Accordion

**Header:** "Add Event" label + chevron icon, 40px height, bg-elevated  
**Disabled state:** accordion locked and visually muted until a loan is created  

**Event Type Selector:** Segmented control or Select dropdown with options:
- Payment
- Additional Advance
- Payment Reversal (NSF)
- Payoff Quote

**Contextual fields per event type:**

| Event Type | Fields shown |
|-----------|-------------|
| Payment | Date picker, Amount (pre-filled with monthly payment, editable) |
| Additional Advance | Date picker, Amount |
| Payment Reversal | Date picker, Reversal dropdown (lists reversible payments by date + amount) |
| Payoff Quote | Date picker (defaults to today) |

- **Submit** button: full width, accent-primary
- Reversal dropdown pre-populated when user clicks a payment row in the ledger

### 6.4 Stat Cards Row

Four cards in a horizontal row above the ledger table. Equal width, flex layout:

| Card | Label | Value format |
|------|-------|-------------|
| 1 | Outstanding Balance | $249,615.00 |
| 2 | Accrued Interest | $142.33 |
| 3 | Next Payment | $1,493.56 |
| 4 | Payoff Today | $249,757.33 |

- bg-elevated, border border-subtle, rounded-lg
- Label: 12px text-secondary above
- Value: 22px font-semibold text-primary, font-mono
- Empty state (no loan): show cards with `—` as value, text-muted

### 6.5 Ledger Table

**Columns:**

| Column | Width | Alignment | Format |
|--------|-------|-----------|--------|
| Date | 110px | Left | MMM DD, YYYY |
| Type | 140px | Left | Badge (see 6.6) |
| Amount | 120px | Right | $0.00, font-mono |
| Interest | 120px | Right | $0.00, font-mono |
| Principal | 120px | Right | $0.00, font-mono |
| Balance After | 130px | Right | $0.00, font-mono |

- Table header: sticky, 40px height, text-secondary uppercase 12px, border-bottom
- Row height: 44px (comfortable)
- Row hover: bg-hover
- Alternating rows: optional subtle bg difference
- Scrollable independently within its container
- Empty state: centered message "No events yet. Create a loan to get started."

**Clickable rows:** Payment rows are clickable — clicking one highlights the row (bg-active, left accent border in accent-primary) and pre-populates the reversal dropdown in Add Event form. Click again to deselect.

### 6.6 Event Type Badges

Each row shows a colored badge in the Type column:

| Event Type | Badge color | Label |
|-----------|-------------|-------|
| funding | accent-success (green) | Funding |
| payment | accent-primary (indigo) | Payment |
| additional_advance | accent-warning (amber) | Advance |
| payment_reversal | accent-error (red) | NSF Reversal |
| payoff | text-secondary (muted) | Payoff |

### 6.7 Reversed Payment Rows

When a payment has been reversed:
- Original payment row: **struck-through text** (`line-through`), text-muted, bg slightly muted
- NSF badge shown on the original row in addition to strikethrough
- Reversal row appears immediately below with `payment_reversal` type badge
- Reversal row: accent-error tinted left border (2px), normal text weight

```
Example:
──────────────────────────────────────────────────────────────────
Feb 01, 2026  ~~[Payment]~~  ~~$1,493.56~~  ~~$1,108.56~~  ~~$385.00~~  ~~$249,615.00~~  [NSF]
Feb 08, 2026  [NSF Reversal]  —             —              —             $250,000.00
──────────────────────────────────────────────────────────────────
```

### 6.8 Day-Count Convention Toggle

Located in the app header, right side:

```
[ Actual/365 | 30/360 ]
```

- Segmented control (two options)
- Switching instantly re-replays all events and updates all figures
- Active option: bg-active, text-primary
- Inactive: text-secondary

### 6.9 Light/Dark Mode Toggle

- Sun/Moon icon button in app header
- Switches Tailwind dark class on root element
- Default: dark mode
- Persisted in localStorage for the session

---

## 7. Interaction & Behavior

### 7.1 Form Interactions

| Interaction | Behavior |
|------------|---------|
| Input focus | ring-2 ring-accent-primary, subtle glow |
| Input error | ring-2 ring-accent-error, error message below in text-error 12px |
| Submit success | Form resets to default, ledger updates immediately |
| Submit disabled | Button disabled + text-muted when required fields empty |

### 7.2 Sidebar Collapse/Expand

- Toggle button at bottom of left panel: `◀` when expanded, `▶` when collapsed
- Collapse: panel animates to 64px width, form content fades out (200ms ease-out)
- Expand: panel animates to 280px, content fades in (200ms ease-out)
- Icon rail shows: ⚙ (Loan Setup), + (Add Event), ▶ (expand)
- Clicking an icon in collapsed state expands the panel and opens that accordion

### 7.3 Ledger Row Click (Reversal Pre-fill)

- Hover: row bg-hover, cursor pointer on payment rows only
- Click: row highlighted bg-active + 2px left border accent-primary
- Add Event accordion automatically expands if collapsed
- Event type automatically set to "Payment Reversal"
- Reversal dropdown pre-populated with clicked payment
- Click same row again: deselects, clears form pre-fill

### 7.4 Animations

| Animation | Duration | Easing |
|-----------|----------|--------|
| Sidebar collapse/expand | 200ms | ease-out |
| Accordion open/close | 150ms | ease-out |
| Row highlight | 100ms | ease-out |
| Theme toggle | 150ms | ease-out |
| Stat card value update | 100ms | ease-out |

All animations respect `prefers-reduced-motion` — disabled when user has reduced motion enabled.

### 7.5 Empty States

| State | Message |
|-------|---------|
| No loan created | Left panel shows Loan Setup expanded. Right panel: centered "Create a loan to get started." Stat cards show `—`. Add Event accordion locked. |
| Loan created, no payments | Ledger shows funding row only. Add Event unlocked. |
| Post-payoff | Add Event form disabled with message: "This loan has been paid off. No further events can be posted." |

---

## 8. Accessibility Requirements

Targeting **WCAG 2.1 Level AA** per ACCESS-* standards:

| Rule | Implementation |
|------|---------------|
| [ACCESS-1] Color contrast | All text meets 4.5:1 ratio. Verified for both light and dark modes. Muted text (text-muted) used only for non-essential decorative content. |
| [ACCESS-2] Keyboard navigation | All interactive elements reachable via Tab. Accordion toggled with Enter/Space. Table rows selectable with Enter. Sidebar toggle with keyboard. |
| [ACCESS-3] Alt text | No meaningful images. Icons have aria-label or aria-hidden as appropriate. |
| [ACCESS-4] Form labels | All inputs have explicit `<label>` elements. Placeholder text used in addition to, not instead of, labels. |
| [ACCESS-5] Focus indicators | Visible focus rings on all interactive elements using ring-2 ring-accent-primary. Browser defaults never removed without replacement. |
| [ACCESS-6] Semantic HTML | `<main>`, `<aside>`, `<table>`, `<thead>`, `<tbody>`, `<th scope>` used appropriately. Buttons are `<button>` not `<div>`. |
| [ACCESS-7] Error identification | Form errors described in text below the field, not just by color change. |

**Additional:**
- Ledger table uses `<th scope="col">` for column headers
- Reversed rows include `aria-label="Reversed payment"` on the struck-through row
- Stat cards use `aria-live="polite"` so screen readers announce value changes after events

---

## 9. Non-Goals (Out of Scope for v1)

- No mobile responsive layout — desktop only (min-width 1024px)
- No Figma file — implementation directly from this DRD
- No skeleton loading states — all data is in-memory and instant
- No toast notifications — inline form errors and state messages only
- No drag-to-reorder events
- No print stylesheet

---

## 10. Technical Constraints

- **Shadcn UI components to use:** `Button`, `Input`, `Label`, `Select`, `Accordion`, `Badge`, `Table`, `Separator`, `Switch` (for toggles)
- **Tailwind CSS** for all spacing, color tokens, and typography — no inline styles
- **Dark mode via Tailwind:** `darkMode: 'class'` in tailwind.config — toggle adds/removes `dark` class on `<html>`
- **Font:** Inter via `@fontsource/inter` or system-ui fallback — no Google Fonts CDN call
- **No external icon library required** — Shadcn ships with Lucide icons (`lucide-react`)
- **Monospace numbers:** `font-mono` Tailwind class on all financial figures to prevent layout shift as numbers change
- **Table overflow:** Ledger table wrapped in `overflow-x-auto` container for safety, though desktop-only

---

## 11. Developer Notes

- Left panel collapse state stored in `useState` locally in `App.tsx` — not in the loan reducer (it's UI state, not domain state)
- Light/dark mode stored in `localStorage` and applied on mount via `useEffect` adding/removing `dark` class on `document.documentElement`
- Clicked ledger row ID stored in local `useState` in `LoanLedger.tsx`, passed up via callback to pre-fill `AddEvent.tsx` — or stored in the reducer's `ui` slice
- All monetary values displayed using: `(cents / 100).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })`
- Struck-through rows: Tailwind `line-through opacity-50` classes conditionally applied when `event.id` appears as `reversesEventId` in any reversal event

---

## 12. Success Criteria

- SC-1: Ledger table is the visually dominant element — takes >60% of horizontal screen space when sidebar is expanded, >90% when collapsed
- SC-2: All four stat cards update immediately after each event is posted
- SC-3: Reversed payment rows are immediately distinguishable from active rows without needing to read the type badge
- SC-4: Clicking a payment row in the ledger pre-fills the reversal form within 100ms
- SC-5: Day-count toggle updates all ledger figures without any visible layout shift
- SC-6: Light and dark modes both pass WCAG AA contrast requirements
- SC-7: All form inputs are reachable and operable via keyboard alone

---

## 13. Open Questions

- **OQ-1:** Should the payoff quote date picker default to today's date or the date of the last event?  *(Recommendation: today's date — most useful default)*
- **OQ-2:** Should negative principal (when interest exceeds payment) be shown in accent-error red in the table? *(Recommendation: yes — makes the edge case immediately visible)*
- **OQ-3:** Should the monthly payment amount in the Loan Setup section update live as the user types terms, before they click Create? *(Recommendation: yes — gives instant feedback on the amortization formula)*
