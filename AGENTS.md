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
npm install      # install dependencies
npm run dev      # start the Vite dev server
npm run lint     # run ESLint over the project
npm run build    # type-check (tsc -b) and produce a production build
npm run preview  # preview the production build locally
```

Always run `npm run lint` and `npm run build` before considering a change done.
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

## Working agreement

- Keep changes scoped and focused; do not refactor or add features beyond the
  request.
- Preserve behavior unless a change explicitly requires altering it.
- Document meaningful architectural shifts in `README.md`; track delivery phases
  in `PLAN.md`.
- Use Conventional Commit messages (e.g. `feat:`, `fix:`, `docs:`,
  `refactor:`); commit at logical boundaries.
