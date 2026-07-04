# Samples

Reference D&D 5e character data used as fixtures and examples for the app's
**Quick start** import feature (paste text / OCR from a D&D Beyond sheet). These
files are not part of the application bundle.

- `yad-armhand.md` — authoritative character reference (Goliath Pugilist 8),
  written from the D&D Beyond character builder. Good sample text for the
  `import/parseCharacter.ts` importer.
- `yad-armhand.html` — a standalone, self-contained HTML character sheet
  prototype for the same character (opens directly in a browser).
- `yad-armhand-ddb.txt` — a plain-text D&D Beyond-style paste transcribed from
  the screenshots, used as the fixture for the importer test
  (`src/import/parseCharacter.yad.test.ts`).
- `yad-armhand-ddb.json` — the real D&D Beyond character JSON (from the
  character-service API), used as the fixture for the JSON importer test
  (`src/import/parseCharacterJson.test.ts`).
- `screenshots/` — reference screenshots grouped by tab/view; see
  [screenshots/README.md](screenshots/README.md). The PNGs are git-ignored.
