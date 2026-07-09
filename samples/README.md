# Samples

Reference D&D 5e character data used to build and sanity-check the app-native
sample sheets. These files are not part of the application bundle.

- `yad-armhand-ddb.json` / `amarthon-ddb.json` — source D&D Beyond character JSON
  exports, kept as the reference data the sample-sheet generators are built from.
- `yad-armhand-sheet.json` / `amarthon-sheet.json` — the app-native sheets built
  from those characters (loadable via **Import JSON…**). Regenerate them with the
  generators in `scripts/` (`node scripts/gen-yad.mjs`,
  `node scripts/gen-amarthon.mjs`).
- `yad-armhand.md` — authoritative character reference (Goliath Pugilist 8),
  written from the D&D Beyond character builder.
- `yad-armhand.html` — a standalone, self-contained HTML character-sheet
  prototype for the same character (opens directly in a browser).
- `yad-armhand-ddb.txt` — a plain-text D&D Beyond-style transcription kept for
  reference.
- `screenshots/` — reference screenshots grouped by tab/view; see
  [screenshots/README.md](screenshots/README.md). The PNGs are git-ignored.
