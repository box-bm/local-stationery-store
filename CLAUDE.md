# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is

**Librería POS** — an offline-first desktop POS and inventory app for a stationery store in Guatemala. All data lives in a local SQLite database embedded via `tauri-plugin-sql`. The deploy target is **Windows**, but development and tests run on macOS/Linux.

## Commands

```bash
npm install          # install JS deps (Rust deps are fetched automatically)

npm run tauri:dev    # run the full desktop app in dev mode (Tauri + Vite hot reload)
npm run dev          # frontend-only in browser (no SQLite access, limited functionality)

npm run typecheck    # tsc --noEmit
npm test             # run all tests once (Vitest)
npm run test:watch   # Vitest in watch mode
npm run test:coverage

npm run tauri:build  # produces signed installer (.msi/.exe on Windows)

npm run next-version # preview what version the next merge to main would produce
npm run bump patch   # manually bump version (patch | minor | major | x.y.z)
```

Run a single test file:
```bash
npx vitest run src/lib/calc.test.ts
```

## Architecture

### Stack
- **Frontend:** React 18 + TypeScript + Vite
- **Desktop shell:** Tauri v2 (Rust) — no custom Rust commands; Tauri is used purely for windowing, plugins, and the updater
- **Database:** SQLite via `@tauri-apps/plugin-sql` — all queries are in `src/services/db.ts`
- **UI:** Tailwind CSS + shadcn/ui-style primitives in `src/components/ui/`
- **State:** Zustand (no persistence middleware — settings are serialized manually to `localStorage`)
- **Forms:** React Hook Form + Zod

### Data layer
All SQL lives in `src/services/db.ts`. The DB connection is lazily opened and memoized via `getDb()`. Migrations run at startup and are defined inline in `src-tauri/src/lib.rs`:

| Migration | Description |
|-----------|-------------|
| v1 | Initial schema (`products`, `sell_units`, `sales`, `sale_items`, `stock_movements`) |
| v2 | Seed 3 example products demonstrating dynamic sell units |
| v3 | `customers` table + `customer_id`, `customer_name`, `payment_reference` columns on `sales` |

**Adding a migration:** append a new `Migration { version: N, ... }` to the `migrations` vec in `src-tauri/src/lib.rs`. Migrations are irreversible (no Down migrations).

### Core concept: dynamic sell units
A product is purchased and stored in a **base unit** (e.g., a ream of 500 sheets). It can be sold via multiple **sell units** (e.g., individual sheet, pack of 4, full ream). Stock is always tracked in base units. `quantity_in_base_units` on each `SellUnit` drives deduction: `stockDeducted = quantity_in_base_units × sale_quantity`. See `src/lib/calc.ts`.

### State stores (`src/stores/`)
- `app.ts` — active screen (`pos | inventory | sales | settings`), sidebar collapsed state, centralized stock alert counts
- `cart.ts` — in-progress sale line items; merges duplicate product+unit combos automatically
- `settings.ts` — persisted to `localStorage` as `libreria-settings`; handles language, theme (light/dark/system), currency, store name, PIN lock, payment methods, onboarding flag
- `toast.ts` — ephemeral notifications

### i18n
Two locales: `src/i18n/locales/es.ts` (source of truth for all keys) and `en.ts` (typed to fail compilation if a key is missing). Use `useT()` hook in React components, `t()` outside React (reads from live store state), or `translate(lang, key)` for pure calls.

### Stock alerts
`src/lib/stock.ts` is the single source of truth for status classification (`"ok" | "low" | "out"`). POS, Inventory, and the Sidebar all use `stockStatus()` / `countStock()` from this module. `refreshStockAlerts()` in the app store re-fetches counts from the DB and should be called after any stock-modifying operation.

### Tested modules
Tests use Vitest + Testing Library on jsdom. Only pure logic and Zustand stores are tested — no Tauri APIs (they require the desktop runtime):
- `src/lib/calc.test.ts`
- `src/lib/stock.test.ts`
- `src/lib/utils.test.ts`
- `src/lib/crypto.test.ts`
- `src/i18n/i18n.test.ts`
- `src/stores/cart.test.ts`
- `src/components/pos/Cart.test.tsx`

### CI / release pipeline
- **PR** → `typecheck` + `vitest --changed` (only files touched by the PR)
- **Merge to `main`** → full test suite → auto-detects version bump from commit messages → bumps + commits version files → creates draft GitHub Release
- **Publish the release** → builds signed installers on all platforms; Tauri auto-updater picks them up in-app

Version is determined automatically from **Conventional Commits**: `fix:` → patch, `feat:` → minor, `feat!:` / `BREAKING CHANGE` → major. Commits prefixed with `chore:`, `docs:`, `refactor:`, `test:`, `style:`, `ci:` produce no release. See `scripts/next-version.cjs`.

Signing key is in `.keys/libreria.key` (not committed to the public remote). See `DISTRIBUTION.md` for the full release workflow.

### Path alias
`@/` maps to `src/` (configured in `vite.config.ts` and `tsconfig.json`).
