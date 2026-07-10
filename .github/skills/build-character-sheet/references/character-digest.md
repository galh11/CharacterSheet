# Character Digest Contract

The Stage-2 sweep subagent reads the raw source character
(`samples/<slug>-source.*`) and writes a compact **digest** to
`samples/<slug>-digest.md`. The digest is the *only* thing the Stage-3 build
agent reads, so it must contain everything needed to build a faithful sheet — and
nothing else. Drop all the raw export noise (internal IDs, timestamps, definition
blobs, UI state, per-modifier bookkeeping, unused options) — but **not** the
player's own custom item names and notes in `characterValues`, which are real,
sheet-relevant data (see the rule below and "What to leave out").

## Rules for the sweep

- **Compute and record final values _with their derivation_**, not raw pieces.
  For each ability, give the score and a one-line note on how it was reached
  (base + racial + ASI + feat). For AC/HP/speed/initiative/proficiency, give the
  final number and the formula/source (e.g. "AC 16 = Studded Leather 12 + DEX mod
  + Shield 2").
- **Prefer rules over sheet display.** D&D Beyond's displayed rows can include
  duplicate/auto-generated attacks or pre-summed numbers; record the underlying
  rule (die + ability + proficiency) so the generator can make it computed.
- **Level-gate features.** Only include class/subclass/species/feat features the
  character actually has at its current level; note limited uses and recharge.
- **One line per feature/item**: name + the mechanical effect that matters for
  play (a bonus, a resource, an on-hit rider). Skip pure flavor text.
- **Mine `characterValues` for custom item names & notes.** D&D Beyond stores a
  player's overrides there, *not* on the item `definition`, so they are trivially
  missed: `typeId 8` is a custom **name** (e.g. a plain Studded Leather renamed
  "Reinforced Studded Leather"), `typeId 9` is a custom **note** that frequently
  carries homebrew mechanics ("Reduce all damage taken by 3" = Damage Reduction 3;
  "Darkvision 15 ft" = a sense). Match each by its item's inventory id (`valueId`)
  and fold the rename + note into that item's line. These are real bonuses — never
  drop them as bookkeeping.
- Keep it tight — a couple of pages of markdown, not the raw megabyte.

## Digest template

```markdown
# <Name> — Digest

## Identity
- Name, Race/Species, Class + level (+ subclass), Background, Alignment (opt.)
- Proficiency bonus, size, walking speed (+ other speeds)
- Armor / weapon / tool proficiencies; languages

## Ability scores (score — derivation)
- STR n (base + …), DEX n (…), CON n (…), INT n (…), WIS n (…), CHA n (…)
- Note the spellcasting ability if any.

## Defenses & vitals
- Max HP = <formula and value>; hit dice pool (count + die)
- AC = <formula and value>; Initiative = <formula>
- Passive Perception/Investigation/Insight (+ formulas)
- Resistances / immunities / vulnerabilities; senses (darkvision N, etc.)

## Saving throws & skills
- Proficient saves: list (mark expertise)
- Proficient skills: list (mark expertise, and any always-on advantage)

## Attacks / actions (name — to-hit — damage — notes)
- e.g. Longbow — +{dex_mod + proficiency} — 1d8+{dex_mod} piercing — range 150/600
- Per-weapon variants (Shillelagh, Flame Tongue, Booming Blade…) → note as toggles.

## Spellcasting (if any)
- Spell save DC + spell attack (formulas), spellcasting ability
- Spell slots per level (e.g. 4/3/3/2)
- Cantrips known; prepared/known spells (names, grouped by level)

## Features & traits (name — one-line effect)
- Class, subclass, species, feat, and background features (level-gated)
- Flag any that grant a numeric bonus to a specific field (→ relational effect)
  or that gate/add attack damage (→ action toggle).

## Resources (limited uses)
- name — max — recharge (short/long/none) — what it fuels

## Inventory & coins
- Coins: CP/SP/EP/GP/PP amounts
- Notable magic gear (name — worn/equipped/carried — effect)
- Apply custom item names + notes from `characterValues` (a rename, or a note that
  grants a bonus / DR / sense) to the relevant item's line.
- Mundane gear (can be grouped onto a few lines)

## Conditions / misc
- Any starting conditions; inspiration; concentration notes.
```

## What to leave out

Internal/definition IDs, entity type IDs, `characterId`, timestamps, avatar and
theme URLs, campaign/social blobs, the full spell/item **definition** objects,
per-modifier `componentId`/`componentTypeId` bookkeeping, and any option the
character did not take. If in doubt, ask: "does this change a number, a resource,
or an on-play reminder on the sheet?" If not, drop it.

**Do keep** the `characterValues` array's custom item **names** (`typeId 8`) and
**notes** (`typeId 9`). Despite looking like bookkeeping, they are player-authored
renames and homebrew effects (damage reduction, senses, extra riders) that belong
on the sheet — the single easiest real bonus to overlook when sweeping a DDB
export.
