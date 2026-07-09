# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project overview

CharacterSheet is a crammed, interactive D&D 5e player cheat sheet: a free-form,
fully editable canvas where the player creates sections and fields, drags and
resizes them, defines calculations and relational effects (one field granting
bonuses to another), writes on-hover descriptions, and can quick-start by
importing a D&D Beyond character JSON export.

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
run `conda activate nodejs` first in any new terminal, then `npm …` works.

## Project structure

```
src/
  App.tsx                  # top-level layout, header/toolbar, canvas wiring, modals, handlers
  main.tsx                 # React entry point
  index.css                # Tailwind import + base styles
  model/
    characterSheet.ts      # zod schema: sheet > sections > fields (+ effects) + layout; slugify
    formula.ts             # safe arithmetic evaluator (no eval/Function): + - * / %, floor/ceil/round/abs/min/max/sqrt
    compute.ts             # resolveSheet: computed fields + relational effects -> results/scope/contributions/tags; interpolate {expr}
    dice.ts                # d20 (advantage/disadvantage), damage, crit flags, roll formatting
    layout.ts              # canvas geometry: compactLayouts (Tidy), snap/align/distribute, overlap resolution
  state/
    useSheet.ts            # central sheet state + immutable mutation ops + undo/redo
    persistence.ts         # versioned localStorage load/save/clear (+ migration)
    transfer.ts            # whole-sheet JSON export / import
    roster.ts              # multiple characters (character-sheet:char:{id}, character-sheet:roster:v1)
    backups.ts             # local version history / restore
    presets.ts             # named saved canvas layouts
    share.ts               # shareable URL encode/decode
    templates.ts           # ready-made section templates
  import/
    parseCharacterJson.ts  # exact D&D Beyond character-service JSON importer
                           # (abilities, AC, skills, saves, HP, initiative, inventory, currency, languages)
  components/
    SectionCard.tsx        # section frame: header, ✎ pencil, collapse/pin; hosts SectionBody
    SectionBody.tsx        # renders each section kind's widget (abilities/hp/skills/actions/…) + effect badges
    SectionEditorModal.tsx # per-section editor (fields, formulas, kind, colour, effects) — opened by the ✎ pencil
    CanvasItem.tsx         # drag-to-move / drag-to-resize wrapper + handle bar
    RollLog.tsx            # floating roll panel: latest roll + expandable history, adv/dis, resizable
    Menu.tsx               # dropdown menu primitives (Menu / MenuItem / MenuDivider / MenuLabel)
    HitDiceModal.tsx       # spend hit dice on a short rest
    QuickStartModal.tsx    # D&D Beyond JSON import review + confirm (paste or file upload)
    Tooltip.tsx            # hover/focus description bubble
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
  workflows/               # ci.yml (lint/build/test/e2e), automerge.yml (CI-gated auto-merge), deploy.yml (Pages)
  copilot-instructions.md  # always-on agent rules (worktree + PR + docs); points here
  prompts/task.prompt.md   # invokable /task: bootstrap a worktree task end-to-end
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
  applies **relational effects**: a field's `effects` (add/sub/set, or typed tags
  like advantage/resist) contribute to a target slug, returning `contributions`
  and `tags` for bidirectional attribution in the UI.
- `{expr}` **interpolation** (`compute.interpolate`) lets action meta (to-hit,
  damage, temp HP…) embed live values, e.g. `+{str_mod + proficiency}`.
- **Section kinds** drive specialized widgets in `SectionBody` (abilities, hp,
  skills, actions, hitdice, conditions, spellslots, initiative,
  currency, timers); the default kind is a plain label/value list. The **HP**
  widget also hosts **death saves** — they appear inside it (successes/failures
  pips, auto-roll, stable/dead) only while Current HP is 0, and clear on any
  healing or long rest.
- Editing is **per-section** via the `SectionEditorModal` (opened by the ✎
  pencil) — there is **no global edit mode**.
- Import is **JSON-only**: `parseCharacterJson` reads a D&D Beyond
  character-service payload (with or without the `data` wrapper). The older OCR /
  tolerant-text importers were removed.
- **Tidy** (`layout.compactLayouts`) packs cards toward the top-left; other
  `layout.ts` helpers handle snapping, alignment, distribution, and overlap.

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

- The `.github/workflows/automerge.yml` workflow squash-merges the PR and deletes
  the branch as soon as the `CI` workflow succeeds on it. No manual approval.
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

### One-time repo setup (maintainer)

So CI truly gates and nothing lands unreviewed-but-unchecked, protect `main`
(GitHub → **Settings → Branches → Add branch protection rule** for `main`):

- **Require a pull request before merging** — Required approvals: **0**.
- **Require status checks to pass** — add the **`test`** check (the CI job).
- Leave "Require branches up to date" **off** so parallel PRs auto-merge without
  serialized re-runs.

With 0 required approvals, no human approval is ever needed; the CI check is the
only gate, and the auto-merge workflow does the merge. (No branch protection is
strictly required for auto-merge to work, but it blocks accidental direct pushes.)

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
