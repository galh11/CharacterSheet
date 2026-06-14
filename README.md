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

## Architecture

- `src/model/characterSheet.ts` — zod schema: sheet → sections → fields + layout.
- `src/model/formula.ts` — safe arithmetic evaluator (no `eval`).
- `src/model/compute.ts` — resolves computed fields and lists references.
- `src/state/` — `useSheet` operations, `persistence`, JSON `transfer`.
- `src/import/` — `parseCharacter` (D&D Beyond text parser) + `ocr` (lazy
  Tesseract.js from CDN).
- `src/components/` — `SectionCard`, `CanvasItem`, `Tooltip`, `QuickStartModal`.

See [PLAN.md](PLAN.md) for the delivery plan and phase status.

## Scripts

```bash
npm install
npm run dev
npm run lint
npm run build
```

## License

MIT. See [LICENSE](LICENSE).
