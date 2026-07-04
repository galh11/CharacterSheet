# CharacterSheet — Delivery Plan

A crammed, interactive D&D 5e player cheat sheet. The goal: a fully editable
canvas where the player can create/edit sections and fields, drag things around,
define calculations, write on-hover descriptions, and quick-start from a D&D
Beyond screenshot or text dump.

## Vision / Requirements

- **Interactive & editable**: everything can be edited in place.
- **Sections & fields**: create, rename, delete sections; add typed fields.
- **Drag & arrange**: move section cards freely around the canvas.
- **Calculations**: fields can hold formulas that reference other fields
  (e.g. ability modifiers, saving throws, spell save DC).
- **On-hover descriptions**: every field/section can carry an editable tooltip,
  useful for rules reminders in and out of combat.
- **Quick start**: paste text or upload a screenshot from the D&D Beyond
  character sheet to auto-generate a starter cheat sheet.
- **Persistence**: never lose work (localStorage) + JSON export/import.

## Status Legend

- [ ] not started
- [~] in progress
- [x] done

## Phases

### Phase A — Data model + persistence  [x]
- [x] Expand model: sections own positioned, typed fields with descriptions.
- [x] localStorage autosave + load.
- [x] Zod validation kept in sync.

### Phase B — Sections with editable fields  [x]
- [x] Render sections as cards holding a list of fields.
- [x] Add / edit / delete fields (label + value).
- [x] Field types: text, number, boolean.
- [x] Add / rename / delete sections.

### Phase C — Drag & resize section cards  [x]
- [x] Free-drag section cards around the canvas.
- [x] Resize cards.
- [x] Persist layout (x, y, w, h).

### Phase D — Computed / calculation fields  [x]
- [x] Safe formula evaluator (arithmetic + helpers like floor/ceil/min/max).
- [x] Reference other fields by name/slug.
- [x] Live recompute as referenced values change.

### Phase E — Editable on-hover descriptions  [x]
- [x] Tooltip component shown on hover.
- [x] Edit description inline in edit mode.

### Phase F — Quick-start import  [x]
- [x] Paste D&D Beyond text → parse abilities, AC, HP, etc. into a sheet.
- [x] Upload screenshot → OCR text → same parser.
- [x] Review/confirm before replacing current sheet.

### Phase G — Toolbar & polish  [x]
- [x] Toolbar: edit toggle, add section, quick start, export, import, reset.
- [x] JSON export / import.
- [x] Visual polish + responsive behavior.

### Phase H — Testing & QA  [x]
- [x] Unit/component tests (Vitest + React Testing Library) for the model,
      state, importer, and components.
- [x] End-to-end tests (Playwright) for load, edit, drag, and persistence flows.
- [x] Visual regression snapshots for view and edit modes.
- [x] Coverage reporting (`npm run test:coverage`).

### Phase I — Continuous integration  [x]
- [x] GitHub Actions: run lint, build, unit tests, and e2e on push / PR.
- [x] Upload the Playwright HTML report as a build artifact.
- [x] Note: visual snapshots are Windows baselines, so CI runs functional e2e
      only until Linux baselines are generated.
- [x] Verify the workflow goes green on the first push.

### Phase J — Deployment  [x]
- [x] Publish the static build to GitHub Pages via Actions (`deploy.yml`).
- [x] Configure the Vite `base` path for project-scoped GitHub Pages.
- [x] Enable Pages (source: "GitHub Actions") in repo settings.
- [x] Live at https://galh11.github.io/CharacterSheet/.

### Phase K — Installable / offline (PWA)  [x]
- [x] Web manifest + service worker for offline use and home-screen install
      (handy as an at-the-table play aid on a phone/tablet).

### Phase L — Data durability  [x]
- [x] Versioned `localStorage` schema + migration path for `character-sheet:vN`.
- [~] Pre-commit hooks: skipped — husky invokes `bash`, which resolves to the WSL
      launcher on this machine (admin prompt). CI enforces lint/build/tests instead.

### Phase M — Importer depth  [ ]
- [ ] Parse attacks, inventory, and saves & skills tables from D&D Beyond.
- [ ] Add tests for the OCR path (`import/ocr.ts`).

## Notes

- Keep changes scoped per phase; commit at each phase boundary.
- Update this file as phases complete.
