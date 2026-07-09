---
mode: agent
description: Start a task in its own git worktree and land it via a CI-gated auto-merging PR.
---

Implement the task described below by following the **"Parallel agents —
worktree workflow"** in [AGENTS.md](../../AGENTS.md) exactly. Do not work on or
push to `main` directly.

1. **Isolate.** `git fetch origin`, then
   `git worktree add ../CharacterSheet-<slug> -b <type>/<slug> origin/main`
   (`<type>` = feat|fix|docs|refactor|test|chore; `<slug>` = unique kebab-case
   topic). `cd` into the worktree and `npm ci`. Node lives in the `nodejs` conda
   env — `conda activate nodejs` first if `npm` isn't found.
2. **Build it.** Implement the task, keeping the diff narrow (other agents work
   in parallel). Commit at logical boundaries with Conventional Commit messages.
   Update **AGENTS.md** / **README.md** / **PLAN.md** if structure, behavior, or
   architecture changed.
3. **Gate.** Run `npm run lint`, `npm run build`, `npm run test:run`, and
   `npm run check:docs` (plus `npm run test:e2e` if you touched UI). Fix anything
   that fails.
4. **Land.** Rebase on `origin/main`, push the branch, and open a PR
   (`gh pr create --fill`). CI gates it and it **auto-merges** when green — do
   not approve it yourself. The task is done only when the PR is merged; then
   clean up the worktree (`git worktree remove …`).

Task:
${input:task:Describe the change to implement}
