# CharacterSheet

A crammed, **interactive D&D 5e player cheat sheet** built with
**React + Vite + TypeScript** and Tailwind CSS. Designed for use both in and out
of combat: build your own layout, define calculations, and keep rules reminders
one hover away.

## Features

- **Free-form canvas** — drag and resize section cards anywhere; the layout is
  saved automatically. **Tidy** packs cards toward the top-left.
- **Per-view drawer** — drag a card toward the drawer tab on the left edge and
  the drawer opens so you can drop it straight in (the card straddles the edge as
  you cross), or use the ⊟ button; drag a card back out onto the canvas to restore
  it. Tucked cards live in a free-canvas scratch-pad you can arrange freely, and
  land where you drop them; ⊞ also restores them. The canvas and stack views each
  have their own drawer, and tucked cards still feed their fields into
  calculations. The tab and panel appear only while the drawer holds something —
  emptying it closes the drawer automatically.
- **Editable everything** — add/rename/delete sections and fields through a
  per-section editor (the ✎ pencil on each card); there is no separate edit mode.
- **Typed fields** — `text`, `number`, `boolean`, `computed`, `counter`, and
  `resource` (pips).
- **Calculations** — `computed` fields run a safe formula engine that can
  reference other fields by name (e.g. `floor((str - 10) / 2)`) and recompute
  live. Helpers: `floor`, `ceil`, `round`, `abs`, `sqrt`, `min`, `max`. Every
  formula box has an **inline autocomplete**: start typing a field name and it
  lists matching slugs grouped by their section, completing the one you pick
  right where the caret is (works mid-formula, e.g. `1d4 + con_mod + pr…`).
- **Relational effects** — any field can grant a modifier to another (add / sub /
  set, or typed tags like advantage / resistance, each with a freeform reason).
  Bonuses and tags are attributed both ways (the source shows what it grants and
  on what, the target shows where it came from) — so next to Athletics you can
  see "ADV to end grappled · Grappler" — across skills, saves, abilities, actions,
  and plain fields, and can be toggled on/off like equipping an item.
- **Action toggles** — a weapon/attack can carry any number of on/off toggles
  that reshape its rolls while active: each toggle can contribute several typed
  damage parts (**add** extra dice or **replace** the base), adjust the to-hit
  ability, or recolour the whole attack to one damage type — all with live
  `{expr}` values. One quarterstaff covers both its mundane Strength swing and a
  Shillelagh that replaces the die and uses your spellcasting ability; a handaxe
  adds 2d6 fire only when its Flame Tongue toggle is lit; a single bonus action
  can add cold *and* radiant damage at once.
- **Play tools** — a dice engine with advantage/disadvantage, a roll log, rests,
  hit-dice spending, HP/temp-HP, conditions, buff timers, and specialized
  section widgets (abilities, skills, actions, spell slots, and a D&D-Beyond-style
  inventory whose coin purse and items share one card…).
- **On-hover descriptions** — give any field a tooltip for quick rules recall.
- **Character portrait** — add a D&D-Beyond-style circular avatar in the top bar;
  click to upload or replace an image (auto-downscaled), hover to remove it.
- **Persistence & portability** — autosaves to a versioned `localStorage` schema
  (with migration) and keeps a **roster** of multiple characters; export/import
  the whole sheet as JSON, or share it via a link. Installable as an offline PWA.
- **Installable (PWA)** — a service worker precaches the app so it works offline
  and can be installed to a phone/tablet home screen for at-the-table use. When a
  new version deploys you get a **"new version available · Reload"** prompt, and
  the ⋯ More menu has a **Check for updates** item to grab the latest build on
  demand instead of waiting for the automatic check.

## Architecture

- `src/model/characterSheet.ts` — zod schema: sheet → sections → fields (+
  relational effects) + layout.
- `src/model/formula.ts` — safe arithmetic evaluator (no `eval`).
- `src/model/compute.ts` — `resolveSheet` (computed fields + effect
  contributions/tags) and `{expr}` interpolation.
- `src/model/dice.ts` — d20 (advantage/disadvantage), damage, crits, formatting.
- `src/model/layout.ts` — canvas geometry: Tidy packing, snap, align, distribute.
- `src/state/` — `useSheet` (+ undo/redo), `persistence`, JSON `transfer`,
  `roster`, `backups`, `presets`, `share`, `templates`.
- `src/components/` — `SectionCard`, `SectionBody`, `SectionEditorModal`,
  `CanvasItem`, `RollLog`, `Menu`, `HitDiceModal`, `AboutModal`, `Tooltip`.
- `scripts/` — `gen-yad.mjs` / `gen-amarthon.mjs` regenerate the sample sheets.
- `src/**/*.test.ts(x)` — unit/component tests (Vitest) next to the code.
- `e2e/` — Playwright end-to-end + visual regression tests.
- `samples/` — reference D&D character data and generated sample sheets.

See [AGENTS.md](AGENTS.md) for the contributor / AI-agent workflow (including the
parallel git-worktree process) and [PLAN.md](PLAN.md) for delivery status.

## Scripts

```bash
npm install
npm run dev
npm run lint
npm run build
```

## Testing

Tests use [Vitest](https://vitest.dev/) (the Vite-native test runner) with
[React Testing Library](https://testing-library.com/docs/react-testing-library/intro/),
which renders components into a simulated DOM and interacts with them the way a
real user would (clicking, hovering, typing) to verify UI/UX behavior.

```bash
npm run test      # watch mode: re-runs tests as you edit files
npm run test:run  # run once (used in CI / one-off checks)
npm run test:ui   # open the interactive test dashboard in a browser
npm run test:coverage  # run once and report how much code is exercised
```

Test files live next to the code they cover and end in `.test.ts`/`.test.tsx`
(for example `src/components/Tooltip.test.tsx`). Coverage spans the pure logic
(`model/formula.ts`, `model/compute.ts`, `model/characterSheet.ts`,
`model/dice.ts`, `model/layout.ts`), the state layer (`state/useSheet.ts`,
`state/persistence.ts`, `state/transfer.ts`, `state/share.ts`), and components
(`Tooltip`, `SectionBody`).

### End-to-end (E2E) tests

[Playwright](https://playwright.dev/) drives a **real Chromium browser** against
the running app to verify full user flows — like dragging a section around the
canvas. These specs live in `e2e/` and are separate from the Vitest tests.

```bash
npx playwright install chromium  # one-time: download the browser
npm run test:e2e                 # run E2E tests (auto-starts the dev server)
npm run test:e2e:ui              # run them in Playwright's interactive UI
```

### Visual regression tests

Some E2E specs capture a screenshot of the app and compare it against a stored
baseline image, so unintended visual changes fail the build. Baselines live in
`e2e/visual.spec.ts-snapshots/` and are committed to the repo.

```bash
npm run test:e2e:update  # refresh baselines after an intentional UI change
```

## Sample data

The [samples/](samples) folder holds reference D&D character data: source
character JSON (`yad-armhand-ddb.json`, `amarthon-ddb.json`), the native sample
sheets built from them (`*-sheet.json`, rebuilt by the `scripts/gen-*.mjs`
generators), and a standalone `yad-armhand.html` / `yad-armhand.md` reference.
The `*-sheet.json` files can be loaded with **Import JSON…**. None of it is part
of the app bundle.

## Deployment

The app deploys to **GitHub Pages** at
<https://galh11.github.io/CharacterSheet/>. The `deploy.yml` workflow builds and
publishes `dist/` after CI passes on `main`. The Vite `base` is set to
`/CharacterSheet/` for production builds (dev stays at `/`).

First-time setup (one-time, in the repo): **Settings → Pages → Build and
deployment → Source: GitHub Actions**.

## License


MIT. See [LICENSE](LICENSE).
