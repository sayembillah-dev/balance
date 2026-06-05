# Balance — Personal Income & Expense Tracker (frontend)

A self-hosted personal finance tracker, implemented from the Claude Design
handoff bundle. Built with **Vite + React + Tailwind CSS v4 + shadcn/ui**.

Flat, teal-accented design system (no shadows/gradients), fully responsive
(desktop / tablet / mobile drawer), with all data persisted to `localStorage`.

## Run

```bash
npm install
npm run dev      # dev server
npm run build    # production build
npm run preview  # preview the build
```

## Routes

- `/` — the app shell (sidebar + topbar + pages)
- `/auth` — Sign in / Sign up (Logout returns here)

## Pages & features

- **Dashboard** — modular widget grid: add/remove from a library, drag-to-reorder, dense auto-fit.
- **Transactions** — search, filter (type/category/mode), sortable Date & Amount, pagination, edit/duplicate/delete, tag chips, responsive table↔card.
- **Accounts** — CRUD + per-account detail with reconciling balances and a filtered transaction list.
- **Categories** — Expense/Income types, categories → sub-categories, hide subs (eye) so they drop out of the txn modal.
- **Tags** — colored labels with per-tag transaction views and totals.
- **Saving & Goals** — savings pool, goal envelopes (status/velocity), Quick Allocate slider, adjust pool.
- **Pay & Receive** — receivables/payables tabs with settle/unsettle, overdue badges, totals.
- **Note** — free-text notes and to-do lists.
- **Budgets** — category- or tag-based budgets with Parallel/Isolated tracking logic.
- **Settings** — multi-tab preferences with dirty-state save/cancel persistence.
- **Global Add-transaction** — 4-tab modal (Expense / Income / Transfer / Preset) reachable from the topbar `+ New`, the Transactions page, and the mobile FAB.
- **AI assistant** — right-side chat drawer grounded in your data (sparkle button in the topbar).

## Architecture notes

- **Design system** lives in `src/index.css` (ported verbatim from the prototype), keyed off CSS variables so the whole app re-themes from one place. Tailwind v4 and shadcn tokens are layered in for utility classes and primitives (`src/components/ui`).
- **Shared data layer**: `src/lib/bal.js` exposes seed data + `localStorage` accessors on `window.BAL`. It is imported first in `src/main.jsx` so page modules can read it at evaluation time.
- **Cross-page communication** uses window `CustomEvent`s: `balance:page` (nav change), `balance:add-txn`, `balance:txn-changed`, `balance:ai-open`.
- **Pages stay mounted** and toggle via `display` (matching the prototype) so per-page state and resize observers survive navigation.
- The AI chat calls `window.claude.complete`; `src/lib/claude.js` installs a local demo responder when no real provider is present.
