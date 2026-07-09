# CharacterSheet — Delivery Plan

A crammed, interactive D&D 5e player cheat sheet. The goal: a fully editable
canvas where the player can create/edit sections and fields, drag things around,
define calculations and relational effects, write on-hover descriptions, and
quick-start by importing a D&D Beyond character JSON export.

## Vision / Requirements

- **Interactive & editable**: everything can be edited in place.
- **Sections & fields**: create, rename, delete sections; add typed fields.
- **Drag & arrange**: move section cards freely around the canvas.
- **Calculations**: fields can hold formulas that reference other fields
  (e.g. ability modifiers, saving throws, spell save DC).
- **On-hover descriptions**: every field/section can carry an editable tooltip,
  useful for rules reminders in and out of combat.
- **Quick start**: import a D&D Beyond character JSON export (paste it or load a
  `.json` file) to auto-generate a starter cheat sheet.
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

### Phase M — Importer depth  [x]
- [x] Parse attacks, inventory, and saves & skills tables from D&D Beyond.
- [x] Add tests for the OCR path (`import/ocr.ts`).
- Note (later): OCR + tolerant text parser were **removed**; import is now
  JSON-only (D&D Beyond character JSON or an exported sheet).

### Phase N — Interactive play sheet  [x]
Everything from the earlier suggestion rounds that we agreed to build:
- [x] Dice engine (`model/dice.ts`): d20 +mod, advantage/disadvantage, crit
      flags, multi-type damage, `{formula}` interpolation for auto to-hit/damage.
- [x] Roll log panel: history (persisted), adv/dis toggle, situational modifier,
      Spend Luck button.
- [x] Section kinds: abilities, hp, skills, actions, hitdice, deathsaves,
      conditions, spellslots, initiative, currency.
- [x] Auto-calc: AC/init/passive/saves/skills/jumps/carry/grapple DC; attacks &
      fisticuffs derived from ability mods + proficiency.
- [x] Rests (short/long), hit-dice spend+heal, direct HP edit, damage reduction.
- [x] Resource-linked action costs, temp-HP appliers (max, no stack),
      Bloodied auto-detect, Concentration save prompt, Flame-Tongue-style toggles.
- [x] Roster (multiple characters), share links, print, PWA.
- [x] Stack view + collapsible sections; component + unit tests (97 passing).

### Phase O — Feature backlog (review of 2026-07-07)

Numbers match that review so items can be picked by number. Legend: ✅ approved
(to build) · ❌ declined · ⏳ deferred/needs decision · [x] already shipped.

Rolling & combat
- [x] **1** ✅ Death-save **auto-roll** button (nat 20 = 1 HP, nat 1 = 2 fails).
- [ ] **2** ❌ Roll vs a target AC/DC (Hit/Miss).
- [x] **3** ✅ Group / repeat rolls (roll a check N times).
- [x] **4** ✅ Preset situational modifiers (Bless +1d4, Guidance +1d4, cover −2/−5).
- [x] **5** ✅ Damage-type resistance / vulnerability (halve/double on the HP Damage button).
- [ ] **6** ⏳ Reroll 1s/2s — Yad lacks the feature; build later as a generic
      per-action option only if a character has it.

Automation & mechanics
- [x] **7** ✅ Exhaustion effect reminder from the Exhaustion counter.
- [x] **8** ✅ Active-state toggles that apply a bonus (Dig Deep, Down But Not Out).
- [x] **9** ✅ Auto-restore Dig Deep when you take a level of exhaustion.
- [x] **10** ✅ Active-buff timers (rounds/minutes countdowns for Large Form, Dig Deep…).
- [x] **11** ✅ Short-rest prompt to spend hit dice inline.
- [x] **12** ✅ Encumbrance vs the computed carrying capacity.

Sheet & data management
- [x] **13** ✅ Duplicate a whole character in the roster.
- [x] **14** ✅ Level-up helper (bump level → proficiency, HP max, hit-dice count).
- [x] **15** ✅ Per-character roll log (instead of one global log).
- [x] **16** ✅ Undo/redo entries with labels ("Undo: HP change").
- [x] **17** ✅ Auto-backup / local version history with restore.
- [ ] **18** ❌ Bulk import characters.

Sharing & polish
- [ ] **19** ❌ Read-only DM share link.
- [x] **20** ✅ Export the layout to PDF/PNG.
- [ ] **21** ❌ QR code for the share link.
- [x] **22** ✅ Search / filter bar to jump to any field or action.
- [x] **23** ✅ Pin sections to top in stack view.
- [x] **24** ✅ Density toggle: Compact ↔ Normal ↔ Comfortable (both directions).
- [ ] **25** ❌ Keyboard shortcuts.
- [x] **26** ✅ Section templates (insert ready-made Attacks/Spellcasting/etc.).
- [x] **27** ✅ Per-character colour theme (accent palette).

D&D extras
- [ ] **28** ⏳ Spell **cards** (distinct from the spell-slots tracker we shipped):
      name/level/range/save/damage + a cast button that spends a slot. Not
      relevant to Yad (no spells); build when a caster is added.
- [x] **29** ✅ Conditions library (one-click add common conditions with rules text).
- [x] **30** ✅ Prominent **Inspiration** toggle (today it's only a generic boolean/condition).
- [x] **31** ✅ Rest log (history of rests and what recovered).
- [ ] **32** ❌ Monster/NPC quick cards for the DM.

### Phase P — Effects, importer depth & play-panel polish  [x]
- [x] **Relational effect system**: any field can grant numeric (add/sub/set) or
      typed (advantage/disadvantage/resist/immune/vulnerable/note) modifiers to a
      target slug. `resolveSheet` folds numeric effects into the scope and returns
      `contributions` + `tags` for bidirectional attribution; per-field effect
      editor with an equip/active toggle (boolean fields follow their own value).
- [x] **Richer D&D Beyond JSON import**: derive AC from equipped armour + DEX, all
      18 skills with proficiency/expertise, saving throws, passive perception, and
      currency (on top of abilities, HP, speed, initiative, inventory, languages).
      Save fields use full ability-name labels so their slugs don't clobber the
      ability scores.
- [x] **Robust Quick start**: uncontrolled textarea (handles ~1 MB pastes), a
      `.json` file-upload option, DDB-first detection, and clearer errors (e.g.
      a private character returns no data); on-screen steps for fetching the JSON.
- [x] **Roll log UX**: show only the latest roll with an expandable history,
      always-visible Clear, and a resizable + persisted panel.
- [x] **Layout & menus**: Tidy rewritten to pack cards into the nearest-corner
      gap; Death Saves merged into the HP widget (shown at 0 HP); dropdown menus
      clamp to the viewport and auto-shift to stay on-screen.
- [x] Action-meta inputs get field type-to-search for `{expr}` interpolation.

## Notes

- Keep changes scoped per phase; commit at each phase boundary.
- Update this file as phases complete.
- **Parallel work:** agents run concurrently, each in its own git worktree on its
  own branch, and a task is done only once merged to `main`. See the
  *Parallel agents — worktree workflow* section in [AGENTS.md](AGENTS.md).
- **CI-gated auto-merge:** PRs merge automatically once the `CI` workflow passes
  (`.github/workflows/automerge.yml`) — no manual approval. CI also runs
  `npm run check:docs`, which fails if a `src/` file is missing from AGENTS.md,
  keeping the docs in sync.
