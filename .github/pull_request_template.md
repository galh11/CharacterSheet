<!-- Keep it scoped and focused. CI must pass before this auto-merges to main. -->

## Summary

<!-- What does this change do, and why? -->

## Checklist

- [ ] `npm run lint`, `npm run build`, and `npm run test:run` pass locally
- [ ] `npm run test:e2e` passes (if you touched UI)
- [ ] If this PR intentionally changes the UI, opt into a baseline refresh —
      add the **`update-visuals`** label, or put **`[update-visuals]`** in this
      title/body — so CI refreshes the Linux visual baselines instead of failing
      the diff
- [ ] `npm run check:docs` passes
- [ ] Docs updated when behaviour/architecture changed — **AGENTS.md** (project
      structure + architecture notes), **README.md** (features/architecture),
      **PLAN.md** (phase status)
- [ ] Tests added/updated for behaviour changes; the suites are green

<!--
CI gates this PR. When CI is green, the Auto-merge workflow squash-merges it to
main and deletes the branch automatically — you do not need to approve it.
Watch progress with `gh pr checks --watch`.
-->
