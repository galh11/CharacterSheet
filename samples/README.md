# Samples

Reference D&D 5e character data used as fixtures and examples for the app's
**Quick start** import feature (which imports a D&D Beyond character JSON export).
These files are not part of the application bundle.

- `yad-armhand-ddb.json` / `amarthon-ddb.json` — real D&D Beyond character JSON
  exports (from the character-service API), used as fixtures for the JSON
  importer test (`src/import/parseCharacterJson.test.ts`).
- `yad-armhand-sheet.json` / `amarthon-sheet.json` — the app-native sheets built
  from those characters. Regenerate them with the generators in `scripts/`
  (`node scripts/gen-yad.mjs`, `node scripts/gen-amarthon.mjs`).
- `yad-armhand.md` — authoritative character reference (Goliath Pugilist 8),
  written from the D&D Beyond character builder.
- `yad-armhand.html` — a standalone, self-contained HTML character-sheet
  prototype for the same character (opens directly in a browser).
- `yad-armhand-ddb.txt` — a plain-text D&D Beyond-style transcription kept for
  reference.
- `screenshots/` — reference screenshots grouped by tab/view; see
  [screenshots/README.md](screenshots/README.md). The PNGs are git-ignored.
