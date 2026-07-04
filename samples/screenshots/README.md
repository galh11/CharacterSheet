# Yad Armhand — D&D Beyond screenshots

Reference screenshots of the "Yad Armhand" character (Goliath Pugilist 8),
grouped by what they show. They are source material for the Quick-Start import
feature and for hand-transcribing the text fixture used by the importer tests
(`../yad-armhand-ddb.txt`).

The PNG files themselves are git-ignored (they are large personal reference
images); this folder structure and the transcribed text are what's tracked.

## Folders

- `sheet/` — full character-sheet scroll: header, ability scores, saving throws,
  skills, senses, proficiencies, and the Actions list with feature descriptions.
- `inventory/` — the Inventory tab (equipment, backpack contents, sundries).
- `features-traits/` — the Features & Traits tab: Class Features, Species Traits,
  and Feats.
- `builder/` — the Character Builder view: the authoritative rules text for the
  class features, level by level.
- `details/` — individual popovers: `ability-scores`, `hit-points`, the
  `skill-*` tooltips, and an `attack-*` row.
- `sheet-recapture/` — a later, near-identical re-capture of the sheet and
  inventory. **Redundant** with `sheet/` and `inventory/`; kept only for
  reference and safe to delete.
