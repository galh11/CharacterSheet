# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project overview

CharacterSheet is a crammed, interactive D&D 5e player cheat sheet: a free-form,
fully editable canvas where the player creates sections and fields, drags and
resizes them, defines calculations, writes on-hover descriptions, and can
quick-start from D&D Beyond text or screenshots.

Stack: React 19 + Vite + TypeScript, Tailwind CSS v4 (via `@tailwindcss/vite`),
zod for schema validation, clsx for class composition.

## Setup & commands

```bash
npm install        # install dependencies
npm run dev        # start the Vite dev server
npm run lint       # run ESLint over the project
npm run build      # type-check (tsc -b) and produce a production build
npm run preview    # preview the production build locally
npm run test       # unit/component tests (Vitest, watch mode)
npm run test:run   # unit/component tests once
npm run test:e2e   # end-to-end + visual tests (Playwright, real browser)
```

Always run `npm run lint`, `npm run build`, and `npm run test:run` before
considering a change done. When touching UI, also run `npm run test:e2e`.
If Node/npm is unavailable in the environment, validate types via the editor's
TypeScript diagnostics instead.

## Project structure

```
src/
  App.tsx                  # top-level layout, toolbar, canvas wiring
  main.tsx                 # React entry point
  index.css                # Tailwind import + base styles
  model/
    characterSheet.ts      # zod schema: sheet > sections > fields + layout
    formula.ts             # safe arithmetic evaluator (no eval/Function)
    compute.ts             # resolves computed fields; lists formula references
  state/
    useSheet.ts            # central sheet state + mutation operations
    persistence.ts         # localStorage load/save/clear
    transfer.ts            # JSON export/import
  import/
    parseCharacter.ts      # tolerant D&D Beyond text parser
    ocr.ts                 # lazy Tesseract.js (CDN) screenshot OCR
  components/
    SectionCard.tsx        # renders + edits a section and its fields
    CanvasItem.tsx         # drag-to-move / drag-to-resize wrapper
    Tooltip.tsx            # hover/focus description bubble
    QuickStartModal.tsx    # import review + confirm flow
  test/
    setup.ts               # Vitest setup: jest-dom matchers + localStorage mock
  **/*.test.ts(x)          # unit/component tests colocated with source
e2e/                       # Playwright end-to-end + visual tests
  app.spec.ts              # functional flows (load, edit, drag, persist)
  visual.spec.ts           # screenshot regression
  visual.spec.ts-snapshots/  # committed baseline images
samples/                   # reference D&D character data (import fixtures)
public/                    # static assets (favicon, icons)
vite.config.ts             # Vite plugins (app build)
vitest.config.ts           # Vitest (unit/component) config
playwright.config.ts       # Playwright config
```

## Code style

- 4-space indentation, single quotes, no semicolons (match existing files).
- Prefer typed, composable React function components and explicit, immutable
  state updates (no in-place mutation of sheet/section/field objects).
- Keep the zod schema in `model/characterSheet.ts` as the source of truth; any
  shape change must update the schema and its inferred types together.
- Validate at boundaries (persistence load, file import); avoid defensive checks
  for states that cannot occur.
- Never use `eval`/`Function` for formulas — extend `model/formula.ts` instead.

## Architecture notes

- The sheet is a single zod-validated object persisted to `localStorage`
  (`character-sheet:v1`) and autosaved on every change via `useSheet`.
- Computed fields reference other fields by slugified label; `compute.ts`
  resolves them over a numeric scope across multiple passes.
- OCR loads Tesseract.js lazily from a CDN, so there is no build-time dependency;
  importers must degrade gracefully to manual text paste if it fails.

## Testing

- **Unit/component** (Vitest + React Testing Library, jsdom): tests are
  colocated with source as `*.test.ts(x)`. `src/test/setup.ts` registers jest-dom
  matchers and an in-memory `localStorage` mock (Node's native global is
  disabled and shadows jsdom's). Config lives in `vitest.config.ts` (kept
  separate from `vite.config.ts` so the app build type-checks cleanly).
- **End-to-end + visual** (Playwright, real Chromium): specs in `e2e/`. The
  config auto-starts the dev server. Visual baselines are committed under
  `e2e/visual.spec.ts-snapshots/`; refresh them with `npm run test:e2e:update`
  after an intentional UI change.
- Vitest ignores `e2e/**`; Playwright only runs `e2e/`. Keep them separate.
- Prefer role/text/label queries over CSS selectors so tests survive refactors.

## Working agreement

- Keep changes scoped and focused; do not refactor or add features beyond the
  request.
- Preserve behavior unless a change explicitly requires altering it.
- Add or update tests alongside behavior changes; keep the suites green.
- Document meaningful architectural shifts in `README.md`; track delivery phases
  in `PLAN.md`.
- Use Conventional Commit messages (e.g. `feat:`, `fix:`, `docs:`,
  `refactor:`, `test:`); commit at logical boundaries.
