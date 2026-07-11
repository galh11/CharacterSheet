# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project overview

CharacterSheet is a crammed, interactive D&D 5e player cheat sheet: a free-form,
fully editable canvas where the player creates sections and fields, drags and
resizes them, defines calculations and relational effects (one field granting
bonuses to another), writes on-hover descriptions, and can save or load a whole
sheet as JSON.

Stack: React 19 + Vite + TypeScript, Tailwind CSS v4 (via `@tailwindcss/vite`),
zod for schema validation, clsx for class composition.

## Setup & commands

```bash
npm install            # install dependencies
npm run dev            # start the Vite dev server
npm run lint           # run ESLint over the project
npm run build          # type-check (tsc -b) and produce a production build
npm run preview        # preview the production build locally
npm run test           # unit/component tests (Vitest, watch mode)
npm run test:run       # unit/component tests once
npm run test:coverage  # unit/component tests once, with coverage
npm run test:e2e       # end-to-end + visual tests (Playwright, real browser)
npm run test:e2e:update # refresh committed visual baselines after an intended UI change
npm run check:docs     # verify every src file is listed in AGENTS.md (CI-enforced)
node scripts/gen-yad.mjs       # regenerate samples/yad-armhand-sheet.json
node scripts/gen-amarthon.mjs  # regenerate samples/amarthon-sheet.json
```

Always run `npm run lint`, `npm run build`, `npm run test:run`, and
`npm run check:docs` before considering a change done. When touching UI, also run
`npm run test:e2e`. If Node/npm is unavailable in the environment, validate types
via the editor's TypeScript diagnostics instead.

**Environment note:** on the maintainer's machine Node isn't on the global PATH —
run `conda activate nodejs` first in any new terminal, then `npm …` works. The
**GitHub CLI (`gh`) is installed in that same `nodejs` env and authenticated**, so
prefer it for GitHub actions an agent used to be unable to do: open/merge/inspect
PRs (`gh pr create` / `gh pr checks` / `gh pr view`), create and apply labels
(`gh label create`, `gh pr edit --add-label`), read failed CI logs
(`gh run view --log-failed`), and trigger `workflow_dispatch` workflows
(`gh workflow run "<name>"`). Manage branch rules via `gh api …/rulesets`.

## Project structure

```
src/
  App.tsx                  # top-level layout, header/toolbar, canvas wiring, modals, handlers
  main.tsx                 # React entry point
  index.css                # Tailwind import + base styles
  version.ts               # APP_VERSION + CHANGELOG (PR-linked) + build time; source for the ⋯ More "What's new" panel
  model/
    characterSheet.ts      # zod schema: sheet (+ optional portrait) > sections > fields (+ effects) + layout; slugify
    formula.ts             # safe arithmetic evaluator (no eval/Function): + - * / %, floor/ceil/round/abs/min/max/sqrt
    compute.ts             # resolveSheet: computed fields + relational effects -> results/scope/contributions/tags; interpolate {expr}
    formulaSuggest.ts      # pure autocomplete helpers: token-at-caret, prefix filter, group-by-section (used by FormulaInput)
    dice.ts                # d20 (advantage/disadvantage), damage, crit flags, roll formatting
    layout.ts              # canvas geometry: dashboard grid (gridMetrics/toCell/snapToGrid/compactGrid), snap/align/distribute, skyline pack
  state/
    useSheet.ts            # central sheet state + immutable mutation ops (incl. moveSection reorder) + undo/redo
    persistence.ts         # versioned localStorage load/save/clear (+ migration)
    transfer.ts            # whole-sheet JSON export / import
    roster.ts              # multiple characters (character-sheet:char:{id}, character-sheet:roster:v1)
    backups.ts             # local version history / restore
    presets.ts             # named saved canvas layouts
    share.ts               # shareable URL encode/decode
    templates.ts           # ready-made section templates
    useAppUpdate.ts        # PWA service-worker update hook (needRefresh + force-check + reload)
    useRollLog.ts          # per-character roll log (newest-first, capped, localStorage-persisted, reloads on switch)
    useSelection.ts        # canvas multi-select + align / match-size / distribute over the selection
    usePresets.ts          # named canvas layout presets (save/apply a snapshot of every card's position)
    usePersistentState.ts  # useState mirrored to localStorage (persisted UI prefs: fit-width, density, grid cols, sidebar)
    sidebarPrefs.ts        # per-user sidebar prefs: draggable width + portrait-size (S/M/L) + core-stat visibility codecs/consts + scope-value helpers (pickScope/fmtSigned)
    useCanvasGridLayout.ts # dashboard grid geometry + zoom + drop/reflow/auto-arrange handlers (extracted from App)
    useDrawerDrag.ts       # drawer + canvas card drag/tuck/restore state + handlers; exports inDrawer (extracted from App)
  components/
    HeaderToolbar.tsx      # the right-hand side nav (rail): profile/portrait, the SidebarStats core-stats panel, character switcher, undo/redo, search, add + View/⋯ More menus, theme swatch, plus the drag-to-resize left edge (double-click resets) and the narrow-width hamburger + overlay (extracted from App.tsx)
    SidebarStats.tsx       # D&D-Beyond-style core-stats panel in the rail: ability mods, interactive HP (damage/heal/temp), AC, Initiative (roll), Proficiency, Speed, Inspiration — read live from the resolved scope; a ⚙ Popover toggles which stats show + picks portrait size
    SectionCard.tsx        # section frame: header, ✎ edit button, collapse/pin; hosts SectionBody
    SectionBody.tsx        # renders each section kind's widget (abilities/hp/skills/actions/…) + effect badges
    SectionEditorModal.tsx # per-section editor (fields, formulas, kind, colour, effects, action toggles) — opened from the ✎ popover's "More settings…"
    SectionQuickEdit.tsx   # the ✎ edit button: a non-blocking Popover for fast rename / accent colour / layout kind (+ "More settings…" opens the full editor)
    SectionNav.tsx         # sidebar "Sections" navigator: collapsible list of the current view's cards; click a row to scroll it into view + select it; highlights the active (selected) card
    Popover.tsx            # lightweight, non-blocking floating panel anchored to a trigger (no backdrop/focus-trap); closes on outside click / Escape; used by SectionQuickEdit
    FormulaInput.tsx       # formula box with inline, section-grouped field autocomplete (completes the slug token at the caret)
    CanvasItem.tsx         # drag-to-move / drag-to-resize wrapper + handle bar
    RollLog.tsx            # floating roll panel: colour-coded rows, flash on new roll, collapsed latest-roll summary, expandable history, adv/dis, drag-to-move + resizable, viewport-capped scroll
    Menu.tsx               # dropdown menu primitives (Menu / MenuItem / MenuDivider / MenuLabel)
    HitDiceModal.tsx       # spend hit dice on a short rest
    AboutModal.tsx         # "What's new" panel: app version, build time, PR-linked changelog (opened from ⋯ More)
    GameMechanicsModal.tsx # "Game mechanics" house-rules pane (opened from ⋯ More → Settings): per-sheet rules like the crit-damage mode
    Tooltip.tsx            # hover/focus description bubble (portaled to body, fixed-positioned so it's never clipped by a card's overflow)
    UpdateToast.tsx        # "new version available" reload prompt (fed by useAppUpdate)
    EmptyCanvas.tsx        # app-level empty state (shown when the sheet has zero sections): + Section CTA + quick template picks
    Toast.tsx              # ToastProvider (queue + auto-dismiss) + Toaster (bottom-centre stack); global action notifications
    toastContext.ts        # ToastContext + useToast() hook + Toast/ToastVariant/ShowToast types (split out for react-refresh)
  test/
    setup.ts               # Vitest setup: jest-dom matchers + in-memory localStorage mock
  **/*.test.ts(x)          # unit/component tests colocated with source
e2e/                       # Playwright end-to-end + visual tests
  app.spec.ts              # functional flows (load, edit, drag, persist)
  visual.spec.ts           # screenshot regression
  visual.spec.ts-snapshots/  # committed baseline images (Windows)
scripts/
  gen-yad.mjs              # regenerate samples/yad-armhand-sheet.json
  gen-amarthon.mjs         # regenerate samples/amarthon-sheet.json
  check-docs.mjs           # CI guard: every src file must be listed in this file
samples/                   # reference character data + import fixtures (yad, amarthon)
public/                    # static assets (favicon, icons, PWA)
.github/
  workflows/               # ci.yml (lint/build/test/e2e + conditional visual), automerge.yml (CI-gated auto-merge), deploy.yml (Pages; runs after Auto-merge), visual-baselines.yml (on-demand Linux snapshot generator)
  copilot-instructions.md  # always-on agent rules (worktree + PR + docs); points here
  prompts/task.prompt.md   # invokable /task: bootstrap a worktree task end-to-end
  skills/build-character-sheet/  # /build-character-sheet: obtain source (fetch public DDB JSON by character id/URL) → sweep to a digest (subagent) → generate + validate a sheet
  pull_request_template.md # PR checklist (tests + docs freshness)
vite.config.ts             # Vite + Tailwind + PWA (app build)
vitest.config.ts           # Vitest (unit/component) config — kept separate from vite.config.ts
playwright.config.ts       # Playwright config (auto-starts the dev server)
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

- The sheet is a single zod-validated object persisted to `localStorage` and
  autosaved on every change via `useSheet`. A **roster** keeps multiple
  characters under `character-sheet:char:{id}` with `character-sheet:roster:v1`;
  the legacy single-sheet key `character-sheet:v1` is migrated in on load.
- **Computed fields** reference other fields by slugified label. `compute.ts`
  `resolveSheet` folds them over a numeric scope across multiple passes and also
  applies **relational effects**: a field's `effects` (add/sub/set/min/max, or
  typed tags like advantage/resist plus a freeform reason in `value`) contribute
  to a target slug, returning `contributions` and `tags` for bidirectional
  attribution in the UI. Numeric ops fold in this order per slug: `set` (override)
  or the natural value, then `add`/`sub`, then the value is clamped by any `min`
  (a floor — the highest wins) and `max` (a cap — the lowest wins). So a Barkskin
  boolean can carry `min ac 16` to floor AC at 16 while active (no more baking
  `max(barkskin*16, …)` into the AC formula), and a shield's `add 2` still
  composes on top before the floor. `EffectTargetBadges` renders those tags —
  abbreviation, reason, and granting
  source inline — next to the target across **default lists, abilities, skills,
  saves, and actions** (e.g. "ADV to end grappled · Grappler" beside Athletics),
  and shows `min`/`max` as a `≥N`/`≤N` chip, while `FieldGrantChips` shows the
  reverse (what the source grants, and on what).
  A **numeric** effect (add/sub) granted to a **skill/save** slug also folds into
  that row's auto-calculated modifier (`SkillRows.skillMod`), so e.g. Primal Order
  Magician's +wis_mod to Arcana reaches the roll — not just the badge.
- `{expr}` **interpolation** (`compute.interpolate`) lets action meta (to-hit,
  damage, temp HP…) embed live values, e.g. `+{str_mod + proficiency}`.
- **Action toggles**: an action/weapon field can carry a list of `toggles`
  (`ActionToggle` in `characterSheet.ts`) — named on/off switches shown in the
  action card. Each toggle carries a list of typed damage `parts` (each `add`s an
  extra part or `replace`s the base weapon damage), can adjust the to-hit
  (`hitMode`), and can recolour the whole attack to one damage type via `setType`
  (e.g. True Strike → radiant). Values use `{expr}` interpolation, so one weapon
  covers a Shillelagh (replace the die + ability), a Flame Tongue (add 2d6 fire
  without changing the base type), or one bonus action that adds several typed
  parts at once (booming blade + cold + radiant). Add as many toggles / parts as
  you like in the section editor (`ActionTogglesEditor`); `ActionCards` folds the
  active ones into attack/damage rolls. A toggle can also be **bound to a boolean
  field** via `toggle.field` (a slug): when set, its on/off state *is* that
  field's live value (read from `scope`), and clicking it flips the shared
  boolean through `onToggleFlag`/`useSheet.toggleField` instead of a local flag.
  The shared boolean can live in any section, so a Flame Tongue can be flipped
  from the weapon's toggle and a dedicated **Ignite bonus-action card** — both
  bound to the same `flame_tongue` field and always in sync (it's a weapon
  buff/state, not a status condition). The editor's **Linked** input autocompletes existing
  boolean field slugs (`booleanReferences`). Legacy shapes migrate on load
  (`foldLegacyActionExtras`): the old single `meta.extra`/`extraWhen` "extra
  damage" folds into `parts` with `extraWhen` preserved as the toggle's linked
  `field`, and the earlier single-`damage` toggle folds into `parts`.
  Cross-field buffs still use field `effects` (relational effects); toggles only
  reshape their own action's rolls.
- **Section kinds** drive specialized widgets in `SectionBody` (abilities, hp,
  skills, actions, hitdice, conditions, spellslots, spellcards, initiative,
  currency, inventory, timers); the default kind is a plain label/value list. The
  **spellcards** kind renders each field as a spell card (name + level/school/
  range/save/damage badges): a **Cast** button spends the linked spell-slot
  resource (`meta.slot`, `meta.cost`) via `onSpend` and logs the cast, and a
  **Damage** button rolls `meta.damage` (with a Crit variant). Level `0`/blank
  shows as *Cantrip* and casts without spending. Save/damage accept `{expr}`
  interpolation (e.g. `DC {spell_save_dc} DEX`). It complements the **spellslots**
  tracker (which holds the slot resources the cards spend). The
  **inventory** kind is a D&D-Beyond-style single card: fields flagged
  `meta.coin` (a coin code like `gp`) render as a coin-purse row of steppers
  across the top, and every other field is an item row below — so currency
  travels with the gear in one section. (The legacy standalone **currency** kind
  still renders older sheets.) The **HP**
  widget also hosts **death saves** — they appear inside it (successes/failures
  pips, auto-roll, stable/dead) only while Current HP is 0, and clear on any
  healing or long rest. The HP widget also **consumes relational-effect tags** an
  item/feature grants to HP-relevant slugs (`damage_reduction`, `defenses`, `hp`,
  `hit_points`): `note` effects (e.g. an armor's flat physical-damage reminder)
  render as source-attributed badges via `EffectTargetBadges`, and
  `resist`/`immune`/`vulnerable` tags (each tag's `value` carries the damage
  type[s]) drive the Damage button's math — halving, zeroing, or doubling a
  matching typed hit — **unioned** with the legacy free-text `Resistances` /
  `Vulnerabilities` fields for back-compat. This lets defenses be authored *on
  their source item/feature* (with attribution) instead of as detached HP fields.
  Flat **damage reduction stays note-only** (informational, not subtracted).
- Editing is **per-section** via the `SectionEditorModal` — there is **no global
  edit mode**. Each card's single **✎ edit button** (`SectionQuickEdit`) opens a
  lightweight, non-blocking `Popover` (no backdrop / focus-trap, unlike the modal)
  for the three tweaks you reach for most — **rename**, **accent colour** (preset
  swatches or a custom colour input) and **layout kind** — plus a *More settings…*
  link that opens the full `SectionEditorModal` (fields, formulas, effects,
  duplicate/delete). It replaced the separate pencil button, whose only extra job
  (open the full editor) is now the popover's *More settings…*. It's wired in both
  views: the `SectionCard` header (stack view) and the `CanvasItem` handle bar
  (canvas view, via the card's `quickEdit` prop). Every formula box (computed field
  value, effect amount, action to-hit/damage, toggle hit/damage) is a
  `FormulaInput`: as you type an identifier it drops an inline autocomplete of
  matching field slugs, grouped under each source section's bold name, and
  completes the token at the caret — so it works mid-formula and inside `{expr}`
  interpolation (`1d4 + con_mod + pr…`). Arrow keys keep the highlighted option
  scrolled into view. Boolean fields are kept out of that formula autocomplete
  (they're 0/1 noise); the "resource to spend / refill" slug inputs instead
  autocomplete spendable resource/counter slugs (`compute.listResourceReferences`),
  while `listReferences` tags each reference with its field `kind` for that split.
- **Formula-backed resource/counter caps**: a `resource`/`counter` field's upper
  bound can be a **`maxFormula`** (schema field on `characterSheet.ts`) instead of
  the static numeric `max`. `compute.resolveFieldMax(field, scope)` resolves it —
  preferring `maxFormula` (evaluated against the sheet scope, rounded, floored at
  0) and falling back to `max` — so a limited-use cap scales with level/ability
  (e.g. `{wis_mod}`, `proficiency`) instead of a frozen literal that drifts on
  level-up. The pip/counter widgets (`ResourcePips`/`Counter`, threaded the
  `scope`) and the rest/refill logic (`useSheet.rest` and `restoreResource`, which
  resolve the scope via `resolveSheet` first) all read the resolved cap, so a
  formula-capped resource refills to the right value on a rest. The section editor
  adds a "max formula" `FormulaInput` beside the numeric max input.
- **Formula initiative modifiers**: an `initiative` row's bonus (`meta.mod`) is
  resolved as a formula via `compute.evalModifier(expr, scope)` — it interpolates
  `{expr}` braces, evaluates the result against the sheet scope, and falls back to
  the first signed integer in the string (so a legacy `+2` still works). So an
  initiative modifier can reference `dex_mod`, `proficiency`, or any slug a
  relational effect folds into, and buffs/level changes flow into the d20 roll
  instead of being a frozen number. The section editor's initiative-modifier box
  is a `FormulaInput` (autocompletes field slugs).
- **Portrait**: the sheet carries an optional `portrait` (an image data URL) set
  via `useSheet.setPortrait`. The side nav shows it as a circular avatar above
  the name (D&D-Beyond style); clicking it uploads/replaces an image (downscaled
  to 256px JPEG by `App.readImageAsDataUrl`), and a hover ✕ removes it. Its
  rendered size is a per-user **S/M/L** preset (`character-sheet:portrait-size`,
  default M) chosen in the SidebarStats ⚙ settings popover (`PORTRAIT_SIZE_CLASSES`
  in `state/sidebarPrefs.ts`).
- **Sidebar core stats**: `components/SidebarStats.tsx` renders a D&D-Beyond-style
  "top bar" set of stats at the top of the rail (below the name): the six ability
  **modifiers** (`str_mod`…`cha_mod`), an interactive **HP** control
  (damage/heal/temp via `useSheet.damageHp`/`healHp`/`applyTempHp`), **AC**
  (`ac`/`armor_class`), **Initiative** (a roll button → d20 + mod → roll log),
  **Proficiency** (`proficiency`/`proficiency_bonus`/`prof`), **Speed**
  (`speed`/`walking_speed`) and the **Inspiration** toggle (moved here from the
  profile block). Values are read live from the resolved compute `scope` by
  conventional slug (a badge is hidden if its slug is absent — hybrid auto-detect).
  Which stats show is a per-user global pref (`character-sheet:sidebar-stats`, a
  JSON `Record<StatKey,boolean>` in `state/sidebarPrefs.ts`, all on by default),
  toggled — alongside the portrait size — in a ⚙ `Popover` on the panel. Because the
  sidebar is the default home for the two **section-backed** stats, `App`'s
  `hiddenByStat` filter removes the `hp` and `abilities` sections from the
  canvas/stack/nav while those stats are enabled (toggling the stat off returns
  the card); the field-backed badges (AC/init/prof/speed) are additive reads and
  do **not** hide their source field's card.
- **Side nav**: the app's persistent controls live in a **right-hand vertical
  sidebar** (`<header>` styled as a rail; `md:sticky md:top-0 md:h-screen`, width
  `md:w-[var(--sidebar-w)]`) so the canvas reclaims the full top of the window
  (vertical space is the scarce axis on landscape monitors). The rail width is
  **drag-resizable** via a `col-resize` handle on its left edge (double-click
  resets to the default), persisted per-user (`character-sheet:sidebar-width`,
  clamped by `sidebarPrefs.ts`) and published as the `--sidebar-w` CSS var (set on
  `document.documentElement` from `App`) so anything anchored beside the rail can
  offset by the live width. `App` renders it as the `order-2` flex child of a
  `flex` `<main>`; the canvas/modals sit in an `order-1 flex-1` content column to
  its left. Top-to-bottom it mirrors the video's sidebar anatomy: **profile**
  (portrait avatar, editable name, the **SidebarStats** core-stats panel incl.
  ★ Inspiration, **Rest ▾**, the ✓ Autosaved
  indicator + a ▴/▾ collapse toggle), then a **tools** group separated by thin
  horizontal rules — **Character** (switcher `<select>` + **Character ▾**),
  **history** (undo/redo), a **search** box with an inline magnifier icon (it
  filters the visible cards + fields *and* the drawer list, shows a live match
  count, and Enter jumps to the first match), a **Sections** navigator
  (`SectionNav` — a collapsible list of the current view's cards; click a row to
  scroll it into view + select it, with the active card highlighted and, while
  searching, matched titles highlighted / non-matches dimmed), **add**
  (the violet **+ Section** button + a **+ Template ▾** menu), a single **View ▾**
  menu, then **⋯ More** and the theme-colour swatch. The ▴/▾ toggle hides the
  tools group (persisted as `character-sheet:sidebar-collapsed`), leaving just the
  profile; on narrow (`< md`) widths the rail is hidden and a fixed **≡ hamburger**
  opens it as a right-side overlay (with a backdrop, dismissed by a ✕/tap).
  Dropdown `Menu`s open `align="right"` and auto-nudge back on-screen. The
  floating `RollLog` default anchor shifts left of the rail
  (`md:right-[calc(var(--sidebar-w)_+_1rem)]`) so they don't overlap at any width. **View ▾** consolidates what used to be a row of
  standalone buttons: the Canvas/Stack view mode (with a ✓ on the active
  one), **Zoom** (Compact 80% / Normal 100% / Comfortable 120%, ✓-marked — a
  persisted whole-sheet CSS-`zoom` preset; disabled in canvas view while **Fit to
  width** overrides it), the canvas-only layout
  tools (**Auto-arrange** — fit every card to its content and pack it into tidy
  columns — plus Fit to width, Save this layout…, Apply saved layout), and
  Open/Close drawer (with its tucked-card
  count). Keep the `Character name` input's aria-label and the **+ Section**
  button's exact label — the e2e specs query them.
- **Save / load**: a sheet is portable as JSON via `state/transfer.ts`
  (`exportSheetToFile` / `importSheetFromFile`, both zod-validated) — surfaced as
  **Export JSON** / **Import JSON…** in the ⋯ More menu. There is no external
  (D&D Beyond) importer; import only accepts a sheet this app exported.
- **Game mechanics / house rules**: the sheet carries an optional `rules` object
  (zod `rulesSchema` in `model/characterSheet.ts`) for table house rules that
  change how the app *rolls* without editing any character field. Today it holds
  `critMode` (`'double-dice'` RAW, default, or `'max-plus-roll'` = maximise the
  normal dice then add a rolled set). `model/dice.ts` `critDamage(expr, mode)`
  applies it; `ActionCards`/`SpellCards` pass `critMode` (threaded App → SectionCard
  → SectionBody) into the Crit buttons. `components/GameMechanicsModal.tsx` (⋯ More →
  **Settings → Game mechanics…**) edits it via `useSheet.setCritMode` (undoable).
  The pane is built to grow more toggles (e.g. concentration DC, death-save/crit
  variants). `rules` is optional, so reads fall back to `DEFAULT_CRIT_MODE`.
- **Empty state**: when `sheet.sections.length === 0` (a brand-new or fully
  cleared character) the canvas/stack slot renders `components/EmptyCanvas.tsx`
  instead of a blank canvas — a centered card with a **+ Section** CTA (calls
  `addSection`) plus a quick-pick button per `SECTION_TEMPLATES` entry (calls
  `addTemplateSection`), mirroring the rail's add controls. Section-level empty
  hints (e.g. "No items yet.") are separate and still render per-widget.
- **Toasts**: `components/Toast.tsx` (`ToastProvider` + `Toaster`) plus
  `components/toastContext.ts` (`ToastContext` + `useToast()` hook) give the app a
  global notification queue. `main.tsx` wraps `<App/>` in `ToastProvider`; `App`
  calls `const toast = useToast()` and fires `toast(message, variant?)` — variants
  `info` (default) / `success` (green) / `error` (red, lingers longer) — for
  import/export/share/reset/portrait/level-up/restore/preset/update actions
  (`usePresets` still surfaces its own notices through the same `onNotice` seam,
  wrapped to `success`). The `Toaster` is a bottom-centre fixed stack that renders
  **nothing when empty** (so the resting layout is unchanged) and each toast
  auto-dismisses or can be closed with ✕. It replaced the tiny inline
  "· notice" text that used to sit beside the "✓ Autosaved" indicator.
  `toastContext.ts` is a separate module only because ESLint's
  `react-refresh/only-export-components` forbids exporting the hook next to the
  components.
- **Stack view reorder**: in the Stack (masonry) view each card exposes a ⠿ grip
  handle on hover; dragging it onto another card calls `useSheet.moveSection`
  (native HTML5 drag-and-drop), which reorders the underlying `sheet.sections`
  array (undoable). Pinned cards still sort to the top of the display, so a drop
  reorders the base list rather than the pinned-first view.
- **PWA updates**: the app is a `vite-plugin-pwa` service worker with
  `registerType: 'autoUpdate'`, so an open tab keeps serving the precached build
  until a newer service worker is fetched and activated. `state/useAppUpdate.ts`
  wraps `virtual:pwa-register/react`'s `useRegisterSW` to surface that: when a new
  build is waiting it flips `updateReady`, which shows `UpdateToast` (a "new
  version available · Reload" prompt). The ⋯ More menu's **Check for updates**
  item calls `checkForUpdate` to force an immediate `registration.update()` so you
  don't have to wait for the next automatic check; `applyUpdate` activates the
  waiting worker and reloads onto the new build. (GitHub Pages CDN propagation
  after a deploy is separate and can't be forced from the client.)
- **App version & changelog**: `version.ts` is the single source of truth —
  `APP_VERSION` (the top `CHANGELOG` entry's version) plus a PR-linked release
  list and a Vite-injected `__APP_BUILD_TIME__`. The ⋯ More menu shows
  `What's new · v<APP_VERSION>`, which opens `AboutModal` (version, build time,
  and each release's summary + GitHub PR link). Ship a user-visible change →
  prepend a `CHANGELOG` entry (bumping the version) in the same PR.
- **Dashboard grid canvas**: canvas cards live on a fixed **column grid** (like
  Grafana / Notion / react-grid-layout) so the layout is tidy by construction.
  `layout.ts` `gridMetrics(cols)` defines the geometry (default **12 columns**,
  `rowHeight` 8, `margin` 16); `colWidth` is **derived** so the grid always spans
  a constant `GRID_TOTAL_WIDTH` (1264px = the historical 12-column width, so 12-col
  sheets are pixel-identical) — choosing **fewer** columns therefore makes each
  column (and card) **wider** instead of shrinking the whole canvas, which is what
  lets the column count integrate cleanly with Fit to width and the zoom presets.
  `toCell`/`fromCell`/`snapToGrid`
  convert between pixel rects and whole grid cells (columns rounded, height
  ceiled so a card never loses content). While dragging/resizing a canvas card,
  `CanvasItem` snaps it to the grid (via its `grid` prop) instead of to sibling
  edges. On drop, `App.commitLayout` runs `layout.placeInGrid` — the released
  card is **pinned at the cell where you dropped it** and every other card is
  compacted upward around it (no overlaps), so what you saw while dragging is
  exactly what lands. **While** dragging, `CanvasItem.onGridDrag` feeds the live
  snapped layout to `App.onGridDrag`, which runs the same `placeInGrid` into
  `gridPreview` and re-renders the *other* cards at their reflowed spots (they
  slide out of the way via a short CSS transition; the dragged card tracks the
  cursor). **Auto-arrange** (`App.handleOrganize` → `App.organizeItems`) is the
  single layout button: for each card it measures the natural content width, snaps
  it to whole columns, then measures the height **at that snapped width** (via
  `CanvasItem.measureHeightAtWidth`, so a narrowed card is never cropped) and
  `compactGrid`s — no overlaps, no gaps, idempotent. (It replaced the three
  conflicting Tidy / Fit-all / Spread buttons that fought each other.) The
  **column count** is a persisted
  per-user preference (`character-sheet:grid-cols`, one of **6 / 8 / 12**, chosen
  under **View ▾ → Grid columns**); `App` builds `grid = gridMetrics(gridCols)`
  and `App.changeGridCols` re-packs the canvas (`compactGrid`) onto the new grid.
  While a card is being dragged, faint **column guides** (one strip per column,
  from `grid`) render behind the cards so you can see where they'll snap. The
  canvas div is at least `gridWidth(grid)` wide so all columns are reachable.
  (Existing pixel sheets keep their stored positions until the first
  drag/Auto-arrange snaps them onto the grid.) Other `layout.ts` helpers handle
  alignment/distribution (`compactLayouts`/`tidyLayouts` are retained legacy
  packers, no longer surfaced in the UI). The grid geometry (`grid`/`canvasSize`),
  the fit-to-width / density `canvasZoom`, and the drop / live-reflow / auto-arrange
  handlers (`commitLayout`/`onGridDrag`/`handleOrganize`/`changeGridCols`) are
  extracted into the `state/useCanvasGridLayout.ts` hook, which owns the live
  `gridPreview` reflow and the `dragOverDrawerRef` flag it shares with the drawer.
- **Multi-select bulk actions**: clicking canvas card handles builds the
  `useSelection` hook's `selectedIds` set; while it's non-empty a **selection
  bar** renders above the canvas. Beyond the layout-only align / match /
  distribute controls (from `useSelection`), it offers whole-section bulk actions
  on every selected card: **Duplicate** / **Tuck** (into the view's drawer) /
  **Recolour** (a colour swatch sets `accent`) / **Delete** (confirms first).
  Each — except Tuck, which loops `App.hideSection` — is a single undoable step
  via `useSheet.duplicateSections`/`recolorSections`/`deleteSections` (batch
  mutations that `commit` once), and confirms with a `useToast` toast.
- **Canvas control**: drag the empty canvas **background** to pan (scroll) the
  viewport (a non-moving click clears the selection). **Fit to width** scales the
  whole canvas so its content fills the current window width edge-to-edge: it
  zooms by `containerWidth / (maxX − minX)` — the cards' **real** left-to-right
  extent, not the padded scroll area — and shifts the canvas left by the leftmost
  card (`marginLeft: −minX`) so both edges are flush with no trailing gap. While
  it's on, the whole app drops its `max-w-7xl` cap so `main` spans the **full
  viewport** (otherwise the fill would stop at 1280px on wide screens). It can
  up-scale narrow sheets too (clamped 0.3–3×) and adapts to window resize /
  browser page zoom via the container's `clientWidth`. A section's per-view
  `drawer` flags (zod
  schema: `{ canvas?, stack? }`) tuck it into that view's **drawer** — an
  independent, free-canvas scratch-pad — so tucking a card in the canvas doesn't
  affect the stack, and vice-versa (the legacy shared `hidden` boolean migrates
  into `{ canvas: true, stack: true }`). Tuck a card via the ⊟ handle button, or
  by **dragging** it: the prominent violet **drawer tab** on the left edge
  auto-opens the panel as you drag a card near it, and releasing over the panel
  tucks the card **at the drop point** (`App.onCardDragMove` / `onCardDragEnd`
  map the pointer into the target container via `pointToLayout`, subtracting the
  screen-px grab offset before dividing by the *target* container's zoom so a card
  lands exactly where you release it even when the canvas and drawer zooms
  differ). While a card is
  dragged over the drawer it's hidden in place and a **floating preview**
  (`dragPoint` + `dragGrab`) straddles the panel edge; the reverse is just as
  seamless — drag a card out of the drawer and drop it on the canvas to restore it
  there (the scratch-pad switches to `overflow-visible` mid-drag so the card can
  straddle both). The drawer **auto-closes** once its last card leaves
  (`closeDrawerIfEmpty`) — including when a drag that auto-opened an empty drawer
  is dropped back on the canvas — and the fixed panel (docked to the **left**
  edge, `top: 0` to `bottom: 0`) spans the full viewport height clear of the
  right-hand side nav. The tab persists whenever the current view's drawer holds ≥1 card
  (and hides when empty). Inside the drawer each tucked card gets its own
  `drawerLayout` and can be dragged/resized freely; ⊞ restores a card to the
  sheet. Drawer cards still feed their fields into computed formulas. The drawer
  open/drag state (`drawerOpen`/`draggingId`/`dropHot`/`dragPoint`/`dragGrab`), the
  pointer-geometry helpers, and the `onCardDragMove`/`onCardDragEnd`/`hideSection`/
  `showSection` handlers live in the `state/useDrawerDrag.ts` hook (which also
  exports the shared `inDrawer(section, view)` helper).

## Testing

- **Unit/component** (Vitest + React Testing Library, jsdom): tests are
  colocated with source as `*.test.ts(x)`. `src/test/setup.ts` registers jest-dom
  matchers and an in-memory `localStorage` mock (Node's native global is
  disabled and shadows jsdom's). Config lives in `vitest.config.ts` (kept
  separate from `vite.config.ts` so the app build type-checks cleanly).
- **End-to-end + visual** (Playwright, real Chromium): specs in `e2e/`. The
  config auto-starts the dev server. Visual baselines are committed under
  `e2e/visual.spec.ts-snapshots/` (per-platform: `*-chromium-win32.png` for local
  Windows runs, `*-chromium-linux.png` for CI); refresh them with
  `npm run test:e2e:update` after an intentional UI change.
- **CI visual gating**: CI runs on Linux, so it only gates visual regression once
  `*-chromium-linux.png` baselines are committed. The `ci.yml` “Visual regression
  tests” step checks for those files and runs `e2e/visual.spec.ts` when present,
  otherwise skips (functional `app.spec.ts` always runs).
- **Intentional visual changes → opt in with `update-visuals`**: a PR that *means*
  to change the UI opts in either by adding the **`update-visuals`** label
  (easiest for humans) or by putting **`[update-visuals]`** in the PR title
  (easiest for automated agents, which often can't apply labels). CI then
  regenerates the Linux baselines (`npx playwright test e2e/visual.spec.ts
  --update-snapshots`) and **commits them back to the PR branch** instead of
  failing the pixel diff, so visual-changing and visual-neutral PRs can coexist
  without hand-managing baselines. Opting in re-runs CI (the workflow listens for
  the `labeled`/`edited` events); the bot push uses `GITHUB_TOKEN` (so it doesn't
  loop CI) and auto-merge squash-merges the branch head — refreshed baselines
  included — once the run is green. Forgot to opt in on a UI PR? The visual step
  fails; just add the label / marker and CI re-runs and self-heals. (CI checks out
  the PR **branch head** rather than the merge commit so it can push back; rebase
  before opening the PR as usual.)
- **Bootstrapping baselines from scratch**: to generate the very first Linux
  baselines (or outside a PR), run the **Update visual baselines** workflow
  (`.github/workflows/visual-baselines.yml`, `workflow_dispatch`) — with `gh`
  installed an agent can trigger it directly:
  `gh workflow run "Update visual baselines"` (no Actions-UI click needed). It runs
  `--update-snapshots` on an ubuntu runner and uploads the PNGs as the
  `linux-visual-baselines` artifact; download them into the snapshots folder and
  commit them.
- Vitest ignores `e2e/**`; Playwright only runs `e2e/`. Keep them separate.
- Prefer role/text/label queries over CSS selectors so tests survive refactors.

## Parallel agents — worktree workflow

Multiple agents may work on this repo **at the same time**. To stay out of each
other's way, every agent works in its **own git worktree on its own branch**, and
lands its change through a **CI-gated pull request that auto-merges** to `main`.
A task is only **done once that PR is merged** (CI green). Follow this exactly.

### 1. Start — create an isolated worktree off the latest `main`

```powershell
git fetch origin
# <type> = feat|fix|docs|refactor|test|chore ; <slug> = short kebab-case topic
git worktree add ../CharacterSheet-<slug> -b <type>/<slug> origin/main
cd ../CharacterSheet-<slug>
npm ci   # each worktree has its own node_modules
```

- Pick a **unique, descriptive** `<slug>` so branches don't collide with other
  agents (e.g. `feat/spell-cards`, `fix/import-ac`).
- Node lives in the `nodejs` conda env on this machine — `conda activate nodejs`
  first if `npm` isn't found.
- Optional speed-up (only while dependencies are unchanged): reuse the primary
  worktree's modules instead of `npm ci` —
  `New-Item -ItemType Junction -Path node_modules -Target ..\CharacterSheet\node_modules`.

### 2. Work — small, focused, well-tested

- Keep the diff **narrow** (small changes conflict less with parallel agents).
  Be especially careful editing hot shared files like `App.tsx`.
- Commit at logical boundaries with Conventional Commit messages.
- Run the full gate before finishing: `npm run lint`, `npm run build`,
  `npm run test:run`, `npm run check:docs` (and `npm run test:e2e` when you
  touched UI).

### 3. Finish — open a PR; CI gates and auto-merges

Rebase onto the freshest `origin/main`, re-verify, push your branch, and open a
pull request. **CI runs on the PR, and when it passes the change is squash-merged
to `main` automatically — you do not approve it yourself.**

```powershell
git fetch origin
git rebase origin/main        # replay your work on top of others' merges
# resolve any conflicts, then RE-RUN lint / build / test:run / check:docs
git push -u origin <type>/<slug>
# Open the PR with the GitHub PR tooling, or `gh pr create --fill` (if gh installed).
git fetch origin --prune      # after CI runs; the branch auto-deletes on merge
git ls-remote --heads origin <type>/<slug>   # prints nothing once merged
```

- **If your change alters the UI's appearance**, opt into a visual-baseline
  refresh so the visual-regression check doesn't fail: put **`[update-visuals]`**
  in the PR title (agents can always do this), or add the
  **`update-visuals`** label. CI regenerates the Linux baselines and commits them
  back to your branch automatically (see *Testing → Intentional visual changes*).
- The `.github/workflows/automerge.yml` workflow squash-merges the PR and deletes
  the branch as soon as the `CI` workflow succeeds on it. No manual approval.
  Because that merge is pushed with `GITHUB_TOKEN`, it does **not** fire
  `deploy.yml`'s `push` trigger (GitHub's recursion guard), so `deploy.yml` also
  runs `on: workflow_run` after **Auto-merge** completes — that's what actually
  ships each merged PR to GitHub Pages.
- **Confirm the merge landed** — don't stop at "PR opened". Poll after CI passes
  until the remote branch is gone (`git ls-remote --heads origin <type>/<slug>`
  prints nothing) or `gh pr view --json state --jq '.state'` returns `MERGED`.
- If CI **fails**, fix it on the same branch and `git push` again; CI re-runs and
  auto-merges when green.
- **Never** push straight to `main` or force-push it. Your task is done only when
  the PR shows `MERGED`.

### 4. Clean up (after the PR merges)

```powershell
cd ../CharacterSheet                                   # back to the primary worktree
git worktree remove ../CharacterSheet-<slug>
git branch -D <type>/<slug>                            # remote branch auto-deleted on merge
git fetch --prune origin; git merge --ff-only origin/main   # refresh the primary main
```

### Repo setup — the branch gate (maintainer)

`main` is guarded by a repository **ruleset** (`run-ci-before-main`), which you can
inspect or edit with `gh api repos/galh11/CharacterSheet/rulesets` (or GitHub →
**Settings → Rules → Rulesets**). It currently enforces:

- **Require a pull request before merging** — Required approvals: **0**.
- **Block force-pushes** (non-fast-forward) to `main`.
- **No required status check.** CI is intentionally *not* a required check, so the
  **Auto-merge** workflow is the real gate — it squash-merges a PR only after the
  `CI` workflow succeeds. Keeping CI off the required-checks list is what lets the
  `update-visuals` flow's bot-pushed baseline commit (pushed with `GITHUB_TOKEN`,
  which doesn't re-trigger CI) merge hands-free; a required check would block it.

So no human approval is ever needed, direct/force pushes to `main` are blocked,
and the CI-gated Auto-merge workflow does the merge.

### Parallel-awareness checklist

- Rebase on `origin/main` **before** you start and again **before** you open the PR.
- Re-run lint/build/tests/check:docs **after** every rebase — a clean auto-merge
  can still break behavior.
- Keep branches short-lived; integrate often so you don't drift from `main`.
- Only build on merged `main`; never depend on another agent's un-merged branch.
- If your change is architectural, update `AGENTS.md` / `README.md` / `PLAN.md`
  in the same branch so the next agent starts from accurate docs.

## Working agreement

- Keep changes scoped and focused; do not refactor or add features beyond the
  request.
- Preserve behavior unless a change explicitly requires altering it.
- Add or update tests alongside behavior changes; keep the suites green.
- **Keep docs in lockstep.** `npm run check:docs` (CI-enforced) requires every
  `src/` file to appear in AGENTS.md's project-structure map; update the
  **Architecture notes** here plus **README.md** / **PLAN.md** whenever behavior
  or architecture shifts. The PR template has this checklist.
- Use Conventional Commit messages (e.g. `feat:`, `fix:`, `docs:`,
  `refactor:`, `test:`); commit at logical boundaries.
- A task is **not done** until its **CI-gated PR is auto-merged into `main`**
  (lint/build/tests/check:docs green — see *Parallel agents — worktree workflow*).
