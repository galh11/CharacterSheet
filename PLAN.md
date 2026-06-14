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

### Phase D — Computed / calculation fields  [ ]
- [ ] Safe formula evaluator (arithmetic + helpers like floor/ceil/min/max).
- [ ] Reference other fields by name/slug.
- [ ] Live recompute as referenced values change.

### Phase E — Editable on-hover descriptions  [ ]
- [ ] Tooltip component shown on hover.
- [ ] Edit description inline in edit mode.

### Phase F — Quick-start import  [ ]
- [ ] Paste D&D Beyond text → parse abilities, AC, HP, etc. into a sheet.
- [ ] Upload screenshot → OCR text → same parser.
- [ ] Review/confirm before replacing current sheet.

### Phase G — Toolbar & polish  [ ]
- [ ] Toolbar: edit toggle, add section, quick start, export, import, reset.
- [ ] JSON export / import.
- [ ] Visual polish + responsive behavior.

## Notes

- Keep changes scoped per phase; commit at each phase boundary.
- Update this file as phases complete.
