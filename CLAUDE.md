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
- **Desktop shell:** Tauri v2 (Rust) — no custom Rust commands; Tauri is used purely for windowing, plugins, and the updater. **Exception:** `keyring_set`/`keyring_get`/`keyring_delete` in `src-tauri/src/lib.rs` are three narrow custom commands wrapping the `keyring` crate, added specifically to store the Google Drive OAuth refresh token in the OS-native credential store (Windows Credential Manager / macOS Keychain / Linux Secret Service). This was a deliberate, user-authorized exception for that one security-sensitive value — don't take it as license to add other custom commands.
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
| v4 | `cost_total` column on `sale_items` |
| v5 | `uuid_primary_keys` — replaces every autoincrement integer PK with a UUID (needed for Google Drive sync identity across devices); adds `sales.sale_number` (a human-facing sequential number, seeded from the old integer id, since receipts/exports can't show a UUID) |
| v6 | `sync_schema_meta` — adds `app_meta(key, value)` seeded with `schema_version`, read by `src/lib/syncSchema.ts` to gate Google Drive sync against an app build that doesn't understand a newer cloud schema |

**Adding a migration:** append a new `Migration { version: N, ... }` to the `migrations` vec in `src-tauri/src/lib.rs`. Migrations are irreversible (no Down migrations). If the migration changes the schema in a way that matters for Google Drive sync (i.e. almost any schema change), also bump `CURRENT_SCHEMA_VERSION` in `src/lib/syncSchema.ts` and the seeded `app_meta.schema_version` value to match the new migration's version — otherwise older app builds won't correctly detect that a newer schema is in the cloud.

### Core concept: dynamic sell units
A product is purchased and stored in a **base unit** (e.g., a ream of 500 sheets). It can be sold via multiple **sell units** (e.g., individual sheet, pack of 4, full ream). Stock is always tracked in base units. `quantity_in_base_units` on each `SellUnit` drives deduction: `stockDeducted = quantity_in_base_units × sale_quantity`. See `src/lib/calc.ts`.

### State stores (`src/stores/`)
- `app.ts` — active screen (`pos | inventory | sales | settings`), sidebar collapsed state, centralized stock alert counts
- `cart.ts` — in-progress sale line items; merges duplicate product+unit combos automatically
- `settings.ts` — persisted to `localStorage` as `libreria-settings`; handles language, theme (light/dark/system), currency, store name, PIN lock, payment methods, onboarding flag, and non-secret Google Drive sync metadata (enabled flag, device id/name, last-synced info). The OAuth refresh token itself is never stored here — see Google Drive sync below.
- `toast.ts` — ephemeral notifications

### i18n
Two locales: `src/i18n/locales/es.ts` (source of truth for all keys) and `en.ts` (typed to fail compilation if a key is missing). Use `useT()` hook in React components, `t()` outside React (reads from live store state), or `translate(lang, key)` for pure calls.

### Stock alerts
`src/lib/stock.ts` is the single source of truth for status classification (`"ok" | "low" | "out"`). POS, Inventory, and the Sidebar all use `stockStatus()` / `countStock()` from this module. `refreshStockAlerts()` in the app store re-fetches counts from the DB and should be called after any stock-modifying operation.

### Google Drive sync
Optional, off by default. Syncs the whole `.db` file (not row-level) to a single file in the user's Google Drive — **the cloud always wins**: on each tick (`src/services/sync.ts`, `runSyncTick`), a remote change newer than the last known one is offered to the user via a blocking, timed confirmation (`ApplySyncModal`) rather than applied silently; local changes only push up when the remote hasn't diverged. Auth is Google's OAuth Device Authorization Grant (`src/services/googleAuth.ts`) — no local redirect listener needed. The refresh token lives in the OS keyring (`src/services/vault.ts`, via the custom Rust commands noted above), never in `localStorage` or a plain file. Drive file `appProperties` (private, invisible in Drive's UI) carry `lastSyncDeviceId`/`lastSyncDeviceName`/`lastSyncAt`/`dbSchemaVersion`, which is how the app shows "last synced by X" and refuses to pull a schema newer than this build supports (see the migration table above).

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
