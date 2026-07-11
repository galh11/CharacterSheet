# Copilot instructions — CharacterSheet

You are an AI agent working in the **CharacterSheet** repo (React 19 + Vite +
TypeScript, Tailwind v4, zod). **[AGENTS.md](../AGENTS.md) is the source of
truth** for structure, architecture, testing, and workflow — read it. The rules
below are non-negotiable and apply to every task.

## Work in your own worktree on a new branch — never on `main`
Other agents may be working **in parallel**. For any change to the repo:

- Start in an isolated worktree off the latest `origin/main`:
  `git fetch origin` then
  `git worktree add ../CharacterSheet-<slug> -b <type>/<slug> origin/main`
  (`<type>` = feat|fix|docs|refactor|test|chore; `<slug>` = unique kebab topic),
  `cd` into it, and `npm ci`.
- Keep diffs **narrow** (small changes conflict less); be careful editing hot
  shared files like `App.tsx`. Rebase on `origin/main` before you start and
  again before you open your PR.
- **Never** commit or push to `main` directly, and never force-push it.
- Read-only questions don't need a worktree; any change that lands does.

## Finish through a CI-gated, auto-merging PR
- Run the full gate before opening the PR: `npm run lint`, `npm run build`,
  `npm run test:run`, `npm run check:docs` (plus `npm run test:e2e` if you
  touched UI).
- Push the branch and open a PR (use the GitHub PR tooling, or `gh pr create
  --fill` if the `gh` CLI is installed). CI runs and, when green, the change
  **auto-merges** to `main` — do not approve it yourself.
- **If your change alters the UI's appearance** (anything the visual snapshots
  capture), the visual-regression check will otherwise fail. Opt into a baseline
  refresh by putting **`[update-visuals]`** in the PR title (agents can
  always do this) **or** adding the **`update-visuals`** label (if you can apply
  labels). CI then regenerates the Linux baselines and commits them back to your
  branch automatically — no manual snapshot juggling. If you can't do either, say
  so and ask the maintainer to add the label.
- **Confirm it merged** — don't stop at "PR opened". After CI passes, verify with
  git: `git fetch origin --prune`, then `git ls-remote --heads origin <branch>`
  prints nothing (the branch auto-deletes on merge). If CI fails, fix on the same
  branch and push again.
- The task is **done only when the PR is merged**.

## Keep docs in sync (CI-enforced)
- `npm run check:docs` fails if any `src/` file is missing from AGENTS.md's
  project-structure map — update it when you add/rename/remove files.
- When behavior or architecture changes, also update **AGENTS.md** (architecture
  notes), **README.md** (features), and **PLAN.md** (phase status).

## Environment & style
- Node is in a conda env on this machine: run `conda activate nodejs` first in a
  new terminal (if that fails, load the hook:
  `& "$env:USERPROFILE\miniconda3\shell\condabin\conda-hook.ps1"; conda activate nodejs`).
- 4-space indent, single quotes, no semicolons. Immutable state updates. Never
  use `eval`/`Function` for formulas — extend `model/formula.ts`. Keep the zod
  schema in `model/characterSheet.ts` as the source of truth.

Full details, commands, and the step-by-step worktree workflow: **AGENTS.md**.
