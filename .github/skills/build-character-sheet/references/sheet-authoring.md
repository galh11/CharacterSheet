# Sheet Authoring Conventions

How to write a `scripts/gen-<slug>.mjs` generator that emits a valid, fully
computed `samples/<slug>-sheet.json`. The two committed generators are the
canonical examples — read them alongside this file:

- [scripts/gen-amarthon.mjs](../../../../scripts/gen-amarthon.mjs) (Druid 8, spellcaster)
- [scripts/gen-yad.mjs](../../../../scripts/gen-yad.mjs) (Pugilist 8, martial + toggles)

> **Faithfulness — read this first.** These generators are references for
> *structure and patterns*, not content. Build every field from the character's
> own digest; do not copy their items, effects, or numbers, and never clone a
> near-identical existing generator (reconcile each item/effect against the
> digest). `gen-yad.mjs` deliberately includes a couple of illustrative demo
> items ("Ring of Protection (Bone-Carved)", "Knuckle-Wraps of Might") to show
> relational `effects` — those are **not** in Yad's export, so copying the file
> wholesale silently adds fake gear and inflates AC / STR.

The zod schema in [src/model/characterSheet.ts](../../../../src/model/characterSheet.ts)
is the source of truth for shapes; the architecture notes in
[AGENTS.md](../../../../AGENTS.md) explain each section kind's widget.

## Data model at a glance

A sheet is `{ id, name, sections[], portrait? }`.

**Field** `{ id, label, type, value, description?, max?, meta?, effects?, toggles?, effectsActive? }`
- `type`: `text | number | boolean | computed | counter | resource`.
- `value` is always a **string**: raw for text/number/boolean, a **formula** for
  `computed`, a count for `counter`/`resource`.
- `computed` formulas reference other fields by **slug** = `slugify(label)`
  (lowercase, non-alphanumerics → `_`). Helpers available in
  [formula.ts](../../../../src/model/formula.ts): `+ - * / %`, `floor ceil round
  abs min max sqrt`. No `eval`.
- Ability mods are **explicit computed fields** named `<ABBR> Mod`, e.g.
  `STR Mod = floor((str - 10) / 2)`; everything else references `str_mod` etc.
- `resource` needs `max` and usually `meta.recharge` (`short|long|none`);
  hit-dice pools also carry `meta.die` (e.g. `d8`).

**Section** `{ id, title, description?, accent, kind, scale, meta?, fields[], layout }`.

## Section kinds (drive specialized widgets)

`default` (label/value list), `abilities` (stat cards + mod, honors
`meta.cols`), `hp` (bar + Damage/Heal + temp; hosts death saves at 0 HP; hit-dice
pool via a `meta.die` field), `skills` (proficiency dots; each field
`meta.ability`, `meta.prof`, `meta.auto:'true'`), `actions` (attack/damage cards;
`meta.hit/damage/type/range`, plus `toggles`), `hitdice`, `conditions` (boolean
chips), `spellslots` (resource pips), `initiative`, `inventory` (D&D-Beyond-style
card: fields with `meta.coin` are the coin purse, the rest are items), `currency`
(legacy), `timers`.

Use the classic `default` kind unless a specialized widget clearly fits.

## Computed fields & interpolation

- Derive everything: `AC = 12 + dex_mod + 2`, `Passive Perception = 10 + wis_mod
  + proficiency`, `Spell Save DC = 8 + proficiency + wis_mod`.
- Action meta uses `{expr}` interpolation so to-hit/damage stay live:
  `hit: '+{str_mod + proficiency}'`, `damage: '1d10+{str_mod}'`.
- `proficiency` is a plain number field (usually in a Combat section).

## Relational effects (one field buffs another)

Add `effects: [{ target, op, value }]` to a field. `op` ∈
`add|sub|set` (numeric, folded into scope) or `advantage|disadvantage|resist|
immune|vulnerable|note` (annotation tags; `value` holds the reason). Example: a
"Bless" field with `effects:[{target:'ac',op:'add',value:'1'}]`. Boolean fields
apply their effects only while true; others use `effectsActive`.

## Action toggles (per-weapon on/off variants)

For a weapon that changes with a stance/item, add `toggles: [{ id, label,
active, hitMode, hit, parts:[{mode,damage,type}], setType?, description? }]`.
`mode:'add'` appends a damage part, `mode:'replace'` swaps the base die; `setType`
recolours the whole attack. Values support `{expr}`. See gen-yad's Handaxe (Flame
Tongue adds 2d6 fire) for a worked example.

## Layout: column packing + ORDER

Both generators use a `place(fields, kind)` helper that estimates a card's height
from its kind/field count and drops it into the currently-shortest of N columns —
this yields a zero-overlap free-canvas layout. After building all sections, sort
them by a hand-authored `ORDER` array (identity → abilities → checks →
defense/vitals → offense → magic → traits → resources/states → info/inventory),
then **re-pack** (`colBottom.fill(Y0); for (const s of sections) s.layout =
place(...)`) so the canvas order matches the reading order. Copy the helper
verbatim and only adjust the `ORDER` list and per-kind height estimates.

## Boilerplate skeleton

```js
import { writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const F = (label, type, value, extra = {}) => ({
    id: randomUUID(), label, type, value: String(value), description: '', ...extra,
})
const skill = (label, ability, prof) =>
    F(label, 'number', '', { meta: { ability, prof, auto: 'true' } })

// … copy the COLS/place() layout helper from gen-amarthon.mjs …

const sections = []
const S = (title, kind, fields, accent = '#8b5cf6', meta) => {
    sections.push({ id: randomUUID(), title, description: '', accent, kind,
        scale: 1, ...(meta ? { meta } : {}), fields, layout: place(fields, kind) })
}

// … S('Character', 'default', [...]), S('Ability Scores', 'abilities', [...]), etc …

const ORDER = [ /* section titles in reading order */ ]
sections.sort((a, b) => ORDER.indexOf(a.title) - ORDER.indexOf(b.title))
colBottom.fill(Y0)
for (const s of sections) s.layout = place(s.fields, s.kind)

const sheet = { id: randomUUID(), name: '<Name>', sections }
writeFileSync(new URL('../samples/<slug>-sheet.json', import.meta.url),
    JSON.stringify(sheet, null, 2) + '\n')
console.log(`Wrote ${sections.length} sections.`)
```

## Validation

After generating, always run the validator:

```powershell
node .github/skills/build-character-sheet/scripts/validate-sheet.mjs samples/<slug>-sheet.json
```

It `safeParse`s the sheet against the live zod schema and runs `resolveSheet`, so
a bad formula (unknown slug, typo) or a schema violation is reported with the
offending path. Fix the **generator** and re-run; never hand-patch the JSON.
