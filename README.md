# CharacterSheet

A crammed, **interactive D&D 5e player cheat sheet** built with
**React + Vite + TypeScript** and Tailwind CSS. Designed for use both in and out
of combat: build your own layout, define calculations, and keep rules reminders
one hover away.

## Features

- **Free-form canvas** — drag and resize section cards anywhere; the layout is
  saved automatically.
- **Editable everything** — add/rename/delete sections and fields in edit mode.
- **Typed fields** — `text`, `number`, `boolean`, and `computed`.
- **Calculations** — `computed` fields run a safe formula engine that can
  reference other fields by name (e.g. `floor((str - 10) / 2)`) and recompute
  live. Helpers: `floor`, `ceil`, `round`, `abs`, `sqrt`, `min`, `max`.
- **On-hover descriptions** — give any field a tooltip for quick rules recall.
- **Quick start** — paste text from your D&D Beyond character sheet, or upload
  screenshots (OCR'd in the browser), to auto-generate a starter cheat sheet.
  You review what was detected before it replaces your sheet.
- **Persistence & portability** — autosaves to `localStorage`; export/import the
  whole sheet as JSON.
- **Installable (PWA)** — a service worker precaches the app so it works offline
  and can be installed to a phone/tablet home screen for at-the-table use.

## Architecture

- `src/model/characterSheet.ts` — zod schema: sheet → sections → fields + layout.
- `src/model/formula.ts` — safe arithmetic evaluator (no `eval`).
- `src/model/compute.ts` — resolves computed fields and lists references.
- `src/state/` — `useSheet` operations, `persistence`, JSON `transfer`.
- `src/import/` — `parseCharacter` (D&D Beyond text parser) + `ocr` (lazy
  Tesseract.js from CDN).
- `src/components/` — `SectionCard`, `CanvasItem`, `Tooltip`, `QuickStartModal`.
- `src/**/*.test.ts(x)` — unit/component tests (Vitest) next to the code.
- `e2e/` — Playwright end-to-end + visual regression tests.
- `samples/` — reference D&D character data used as import fixtures.

See [PLAN.md](PLAN.md) for the delivery plan and phase status.

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
(`model/formula.ts`, `model/compute.ts`, `model/characterSheet.ts`), the state
layer (`state/useSheet.ts`, `state/persistence.ts`, `state/transfer.ts`), the
D&D Beyond text importer (`import/parseCharacter.ts`), and the `Tooltip`
component.

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

The [samples/](samples) folder holds reference D&D character data
(`yad-armhand.md` and a standalone `yad-armhand.html` prototype). These are used
as fixtures/examples for the D&D Beyond import feature and are not part of the
app bundle.

## Deployment

The app deploys to **GitHub Pages** at
<https://galh11.github.io/CharacterSheet/>. The `deploy.yml` workflow builds and
publishes `dist/` after CI passes on `main`. The Vite `base` is set to
`/CharacterSheet/` for production builds (dev stays at `/`).

First-time setup (one-time, in the repo): **Settings → Pages → Build and
deployment → Source: GitHub Actions**.

## License


MIT. See [LICENSE](LICENSE).
