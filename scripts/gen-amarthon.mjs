// One-off generator: builds Amarthon's sheet in this app's native format from
// samples/amarthon-ddb.json (a D&D Beyond character export). Every derivable
// value is a computed field or a {formula} placeholder so nothing that depends
// on ability mods / proficiency is hand-typed.
// Run: `node scripts/gen-amarthon.mjs` -> samples/amarthon-sheet.json
//
// Character: Amarthon — Variant Human Druid 8 (Circle of the Moon), Sage.
// Verified from the DDB JSON:
//   Abilities STR 8 / DEX 14 / CON 17 / INT 10 / WIS 19 / CHA 10 (base + Variant
//   Human +1 WIS/+1 CON + Sage ASI +2 CON/+1 WIS + two Druid ASIs +1 WIS each).
//   HP = baseHitPoints 43 + con_mod(3) * level(8) = 67. Speed 30. Proficiency +3.
//   AC = Studded Leather 12 + DEX mod + Shield 2 = 16. Spell save DC 15, atk +7.
import { writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const F = (label, type, value, extra = {}) => ({
    id: randomUUID(),
    label,
    type,
    value: String(value),
    description: '',
    ...extra,
})
const skill = (label, ability, prof) =>
    F(label, 'number', '', { meta: { ability, prof, auto: 'true' } })

// Column-packing layout: place each section in the currently-shortest column.
const COLS = 4
const COL_W = 300
const GAP = 20
const X0 = 24
const Y0 = 24
const colBottom = Array(COLS).fill(Y0)
const place = (fields, kind) => {
    const n = fields.length
    let h
    if (kind === 'abilities') h = 96 + Math.ceil(fields.filter((f) => f.type !== 'computed').length / 3) * 66
    else if (kind === 'actions') h = 64 + n * 82
    else if (kind === 'conditions') h = 120 + Math.ceil(n / 2) * 6
    else if (kind === 'hp') h = 230
    else if (kind === 'hitdice') h = 150
    else if (kind === 'spellslots') h = 96 + n * 34
    else h = 96 + n * 30
    let c = 0
    for (let i = 1; i < COLS; i++) if (colBottom[i] < colBottom[c]) c = i
    const x = X0 + c * (COL_W + GAP)
    const y = colBottom[c]
    colBottom[c] = y + h + GAP
    return { x, y, w: COL_W, h }
}

const sections = []
const S = (title, kind, fields, accent = '#8b5cf6', meta) => {
    sections.push({
        id: randomUUID(),
        title,
        description: '',
        accent,
        kind,
        scale: 1,
        ...(meta ? { meta } : {}),
        fields,
        layout: place(fields, kind),
    })
}

// 0. Character identity + proficiencies.
S('Character', 'default', [
    F('Race', 'text', 'Variant Human'),
    F('Size', 'text', 'Medium'),
    F('Class', 'text', 'Druid 8'),
    F('Level', 'number', 8, { description: 'Character level. Use “Level up” in the toolbar to increment, then update HP max, hit dice, spell slots and features.' }),
    F('Subclass', 'text', 'Circle of the Moon'),
    F('Background', 'text', 'Sage'),
    F('Primal Order', 'text', 'Magician'),
    F('Inspiration', 'boolean', 'false', { description: 'Spend to reroll any d20. Toggle from the star in the toolbar.' }),
    F('Armor', 'text', 'Light armor, Shields'),
    F('Weapons', 'text', 'Simple weapons'),
    F('Tools', 'text', 'Herbalism Kit, Calligrapher’s Supplies'),
], '#8b5cf6')

// 1. Ability scores. Each score has an editable computed modifier field
// (wis_mod = floor((wis-10)/2)); the ability cards display that value, and other
// formulas (AC, attacks, saves, spell DC) reference the *_mod slugs.
S('Ability Scores', 'abilities', [
    F('STR', 'number', 8),
    F('DEX', 'number', 14),
    F('CON', 'number', 17),
    F('INT', 'number', 10),
    F('WIS', 'number', 19),
    F('CHA', 'number', 10),
    F('STR Mod', 'computed', 'floor((str - 10) / 2)'),
    F('DEX Mod', 'computed', 'floor((dex - 10) / 2)'),
    F('CON Mod', 'computed', 'floor((con - 10) / 2)'),
    F('INT Mod', 'computed', 'floor((int - 10) / 2)'),
    F('WIS Mod', 'computed', 'floor((wis - 10) / 2)'),
    F('CHA Mod', 'computed', 'floor((cha - 10) / 2)'),
], '#f59e0b')

// 2. Combat — AC, initiative, speed, passives, and spellcasting derived numbers.
S('Combat', 'default', [
    F('AC', 'computed', '12 + dex_mod + 2', { description: 'Studded Leather (base 12) + DEX mod + Shield (+2). Barkskin sets a floor of 16.' }),
    F('Initiative', 'computed', 'dex_mod'),
    F('Speed', 'number', 30),
    F('Passive Perception', 'computed', '10 + wis_mod + proficiency', { description: 'Proficient in Perception.' }),
    F('Spell Save DC', 'computed', '8 + proficiency + wis_mod', { description: 'Druid spellcasting (Wisdom).' }),
    F('Spell Attack', 'computed', 'proficiency + wis_mod'),
    F('Proficiency', 'number', 3, { description: 'Proficiency bonus (level 8). Used by attacks, saves, skills and spell DC.' }),
], '#ef4444')

// 3. Hit points. The hit-dice pool lives here (tagged meta.die) and is spent via
// the Hit Dice popup rather than a section of its own.
S('Hit Points', 'hp', [
    F('Current HP', 'number', 67),
    F('Max HP', 'number', 67),
    F('Temp HP', 'number', 0),
    F('Resistances', 'text', '', { description: 'Comma-separated damage types halved on the Damage button.' }),
    F('Vulnerabilities', 'text', '', { description: 'Comma-separated damage types doubled on the Damage button.' }),
    F('Hit Dice (d8)', 'resource', 8, { max: 8, meta: { die: 'd8', recharge: 'long' } }),
], '#10b981')

// 5. Saving throws (auto: ability mod + proficiency when proficient).
S('Saving Throws', 'skills', [
    skill('Strength', 'STR', 'none'),
    skill('Dexterity', 'DEX', 'none'),
    skill('Constitution', 'CON', 'none'),
    skill('Intelligence', 'INT', 'proficient'),
    skill('Wisdom', 'WIS', 'proficient'),
    skill('Charisma', 'CHA', 'none'),
], '#8b5cf6')

// 6. Skills (auto). Proficient: Arcana, History, Insight, Nature, Perception.
S('Skills', 'skills', [
    skill('Acrobatics', 'DEX', 'none'),
    skill('Animal Handling', 'WIS', 'none'),
    skill('Arcana', 'INT', 'proficient'),
    skill('Athletics', 'STR', 'none'),
    skill('Deception', 'CHA', 'none'),
    skill('History', 'INT', 'proficient'),
    skill('Insight', 'WIS', 'proficient'),
    skill('Intimidation', 'CHA', 'none'),
    skill('Investigation', 'INT', 'none'),
    skill('Medicine', 'WIS', 'none'),
    skill('Nature', 'INT', 'proficient', { description: 'Magician: add your WIS mod (+4) to Arcana and Nature checks.' }),
    skill('Perception', 'WIS', 'proficient'),
    skill('Performance', 'CHA', 'none'),
    skill('Persuasion', 'CHA', 'none'),
    skill('Religion', 'INT', 'none'),
    skill('Sleight of Hand', 'DEX', 'none'),
    skill('Stealth', 'DEX', 'none'),
    skill('Survival', 'WIS', 'none'),
], '#8b5cf6')

// 7. Senses.
S('Senses', 'default', [
    F('Passive Perception', 'computed', '10 + wis_mod + proficiency'),
    F('Passive Insight', 'computed', '10 + wis_mod + proficiency'),
    F('Passive Investigation', 'computed', '10 + int_mod'),
])

// 8. Attacks — to-hit and damage derived from ability mods + proficiency.
S('Attacks', 'actions', [
    F('Quarterstaff (Shillelagh)', 'text', '', {
        description: 'Cast Shillelagh so the staff uses your spellcasting ability and deals 1d8. Topple mastery: on a hit the target makes a CON save (DC {8 + proficiency + wis_mod}) or falls Prone. Primal Strike: once per turn add 1d8 of the weapon’s damage type on a hit.',
        meta: { hit: '+{wis_mod + proficiency}', damage: '1d8+{wis_mod}', type: 'bludgeoning', range: '5 ft' },
    }),
    F('Quarterstaff (mundane)', 'text', '', {
        description: 'Without Shillelagh: Strength-based. Two-handed 1d8.',
        meta: { hit: '+{str_mod + proficiency}', damage: '1d6+{str_mod}', type: 'bludgeoning', range: '5 ft' },
    }),
    F('Longbow', 'text', '', {
        description: 'Slow mastery: on a hit, reduce the target’s Speed by 10 ft until your next turn.',
        meta: { hit: '+{dex_mod + proficiency}', damage: '1d8+{dex_mod}', type: 'piercing', range: '150/600' },
    }),
    F('Poison Spray (cantrip)', 'text', '', {
        description: 'Ranged 10 ft. Target makes a CON save vs your spell DC {8 + proficiency + wis_mod}; on a fail it takes the damage. Scales with level (2d12 at level 8).',
        meta: { damage: '2d12', type: 'poison', range: '10 ft' },
    }),
], '#f59e0b')

// 9. Spellcasting summary.
S('Spellcasting', 'default', [
    F('Ability', 'text', 'Wisdom'),
    F('Spell Save DC', 'computed', '8 + proficiency + wis_mod'),
    F('Spell Attack', 'computed', 'proficiency + wis_mod'),
    F('Prepared (class)', 'text', 'Druid — prepares from the whole Druid list', { description: 'Circle of the Moon druids can swap prepared spells after a Long Rest.' }),
    F('Concentration', 'boolean', 'false', { description: 'War Caster: Advantage on CON saves to maintain Concentration. Toggle on when concentrating.' }),
], '#06b6d4')

// 10. Spell slots (full caster, level 8): 4 / 3 / 3 / 2.
S('Spell Slots', 'spellslots', [
    F('Level 1', 'resource', 4, { max: 4, meta: { recharge: 'long' } }),
    F('Level 2', 'resource', 3, { max: 3, meta: { recharge: 'long' } }),
    F('Level 3', 'resource', 3, { max: 3, meta: { recharge: 'long' } }),
    F('Level 4', 'resource', 2, { max: 2, meta: { recharge: 'long' } }),
], '#8b5cf6')

// 11. Cantrips (at-will).
S('Cantrips', 'default', [
    F('Guidance', 'text', 'Druid', { description: 'Concentration, 1 min. Touch a willing creature; add 1d4 to one ability check of its choice.' }),
    F('Message', 'text', 'Druid', { description: 'Whisper a message to a creature within 120 ft; it can reply.' }),
    F('Shillelagh', 'text', 'Druid', { description: 'Bonus Action: your club/quarterstaff uses your spellcasting ability, deals 1d8, and counts as magical for 1 min.' }),
    F('Poison Spray', 'text', 'Druid', { description: 'CON save or take 2d12 poison (at level 8). Range 10 ft.' }),
    F('Minor Illusion', 'text', 'Magic Initiate (Wizard)', { description: 'Create a sound or image for 1 min.' }),
    F('Booming Blade', 'text', 'Magic Initiate (Wizard)', { description: 'Melee spell attack via a weapon; the target is sheathed in booming energy and takes thunder damage if it moves.' }),
], '#06b6d4')

// 12. Prepared spells (by level). C = concentration, R = ritual.
S('Prepared Spells', 'default', [
    F('— Level 1 —', 'text', ''),
    F('Absorb Elements', 'text', '1'),
    F('Detect Magic', 'text', '1', { description: 'Concentration · Ritual.' }),
    F('Healing Word', 'text', '1', { description: 'Bonus Action heal 2d4 + WIS mod at range.' }),
    F('Speak with Animals', 'text', '1', { description: 'Ritual · always prepared.' }),
    F('Find Familiar', 'text', '1', { description: 'Ritual · via Wild Companion (spell slot or Wild Shape use).' }),
    F('Shield', 'text', '1', { description: 'Magic Initiate: cast free 1/Long Rest, or with a slot. Reaction, +5 AC.' }),
    F('Silvery Barbs', 'text', '1', { description: 'Feat spell. Reaction to force a reroll of a hit/save/check.' }),
    F('— Level 2 —', 'text', ''),
    F('Aid', 'text', '2', { description: 'Raise HP maximum and current HP by 5 for three creatures.' }),
    F('Barkskin', 'text', '2', { description: 'Target’s AC can’t be less than 16.' }),
    F('Pass without Trace', 'text', '2', { description: 'Concentration. +10 to Stealth for the party.' }),
    F('Misty Step', 'text', '2', { description: 'Feat spell. Bonus Action teleport 30 ft.' }),
    F('— Level 3 —', 'text', ''),
    F('Dispel Magic', 'text', '3'),
    F('Revivify', 'text', '3', { description: 'Return a creature dead < 1 min to life with 1 HP.' }),
    F('Syluné’s Viper', 'text', '3'),
    F('— Level 4 —', 'text', ''),
    F('Polymorph', 'text', '4', { description: 'Concentration.' }),
    F('Wall of Fire', 'text', '4', { description: 'Concentration.' }),
    F('Fire Shield', 'text', '4', { description: 'Resistance to cold or fire; retaliate for 2d8.' }),
], '#8b5cf6')

// 13. Features & traits (Druid 8 + Circle of the Moon + feats).
S('Features & Traits', 'actions', [
    F('Druidic', 'text', '', { description: 'You know Druidic, the secret language of druids, and can leave hidden messages. You automatically spot such messages and can decipher them.' }),
    F('Primal Order — Magician', 'text', '', { description: 'You know one extra Druid cantrip (Poison Spray). Add your WIS mod (min +1) to your Intelligence (Arcana or Nature) checks.' }),
    F('Wild Shape (3/rest)', 'text', '', { description: 'Bonus Action: transform into a known Beast form (max CR 1, no Fly Speed until — from level 8 you may take a form with a Fly Speed). Lasts hours = half your level. 3 uses at level 8; regain one on a Short Rest, all on a Long Rest.' }),
    F('Wild Companion', 'text', '', { description: 'Magic action: expend a spell slot or a Wild Shape use to cast Find Familiar without Materials; the familiar is Fey and lasts until your next Long Rest.' }),
    F('Circle Forms', 'text', '', { description: 'Circle of the Moon: while in Wild Shape you can use a Magic action to expend a spell slot and regain 1d8 HP per slot level; your beast forms may have higher CR. (See the subclass table for the CR cap.)' }),
    F('Wild Resurgence', 'text', '', { description: 'Once per turn, if you have no Wild Shape uses left, expend a spell slot to regain one (no action). Also, once per Long Rest, expend a Wild Shape use to gain a level 1 spell slot.' }),
    F('Improved Circle Forms', 'text', '', { description: 'While in Wild Shape you can use your WIS mod in place of Con for concentration and add your WIS mod to the beast form’s attack damage; you also gain the ability to spend a slot to heal in beast form.' }),
    F('Elemental Fury — Primal Strike', 'text', '', { description: 'Once on each of your turns when you hit with an attack roll (including in Wild Shape), deal an extra 1d8 damage of the attack’s type.' }),
    F('Moonlight Step (4/Long)', 'text', '', { description: 'Circle of the Moon: Bonus Action to teleport up to 30 ft to a space you can see; you have Advantage on your next attack this turn. WIS-mod uses per Long Rest; regain uses by expending a level 2+ slot.' }),
    F('Spellcasting', 'text', '', { description: 'Wisdom-based druid casting. Prepare spells from the whole Druid list; swap after a Long Rest. Save DC 15, spell attack +7.' }),
    F('War Caster (feat)', 'text', '', { description: 'Advantage on CON saves to maintain Concentration; cast somatic spells with hands full; cast a spell (1 action, single target) as an opportunity attack.' }),
    F('Magic Initiate — Wizard (feat)', 'text', '', { description: 'Two wizard cantrips (Minor Illusion, Booming Blade) and a level 1 wizard spell (Shield) you can cast free 1/Long Rest or with slots.' }),
    F('Homebrew feats', 'text', '', { description: 'Campaign feats: Dark Bargain, Runestones, Character Threads — grant Silvery Barbs and Misty Step among other benefits.' }),
])

// 14. Resources (rest-aware pips).
S('Resources', 'default', [
    F('Wild Shape', 'resource', 3, { max: 3, meta: { recharge: 'short' } }),
    F('Moonlight Step', 'resource', 4, { max: 4, meta: { recharge: 'long' } }),
    F('Shield (Magic Initiate)', 'resource', 1, { max: 1, meta: { recharge: 'long' } }),
], '#ec4899')

// 15. Conditions & states.
S('Conditions', 'conditions', [
    F('Wild Shaped', 'boolean', 'false', { description: 'Currently in a Beast form.' }),
    F('Concentrating', 'boolean', 'false', { description: 'War Caster: Advantage on CON saves to keep Concentration.' }),
    F('Barkskin', 'boolean', 'false', { description: 'AC floor 16 while active.' }),
    F('Bloodied', 'boolean', 'false', { description: 'At or below half HP (33). Auto-set by the HP tracker.' }),
    F('Prone', 'boolean', 'false'),
    F('Grappled', 'boolean', 'false'),
    F('Frightened', 'boolean', 'false'),
    F('Poisoned', 'boolean', 'false'),
    F('Restrained', 'boolean', 'false'),
    F('Stunned', 'boolean', 'false'),
], '#ef4444')

// 16. Languages.
S('Languages', 'default', [
    F('Common', 'text', 'fluent'),
    F('Elvish', 'text', 'fluent'),
    F('Druidic', 'text', 'fluent'),
])

// 17. Notable gear — magic and renamed/custom items with effects.
S('Notable Gear', 'default', [
    F('Ring of Quick Recovery', 'text', 'worn', { description: 'Adventurer’s Ring: when you regain hit points, regain an additional 3 (once per turn). Also sheds a cold, fuel-free flame (Bright Light 20 ft).' }),
    F('Amulet — Beast Whisper', 'text', 'worn', { description: 'Holy-symbol amulet: Advantage on Wisdom (Animal Handling) checks.' }),
    F('Quarterstaff — True Strike Echo', 'text', 'equipped', { description: '1/Long Rest, gain Advantage on one attack roll.' }),
    F('Spell Scroll — Fire Ball ×2', 'text', 'carried', { description: 'Scroll casts Fire Ball (8d6). Save DC 13 / attack +5.' }),
    F('Spell Scroll — Counterspell ×2', 'text', 'carried'),
    F('Spell Scroll — Slow ×2', 'text', 'carried'),
    F('Potion of Healing (Greater) ×3', 'text', 'carried', { description: 'Regain 4d4 + 4 HP.' }),
    F('Potion of Healing (Superior) ×4', 'text', 'carried', { description: 'Regain 8d4 + 8 HP.' }),
    F('Deep North Expedition Cloak', 'text', 'worn', { description: 'Resistance to environmental cold damage; Advantage on Survival checks to navigate/track/avoid getting lost in arctic terrain.' }),
    F('Storm Hood of Kaldweave', 'text', 'worn', { description: 'See through nonmagical blowing snow/fog/freezing rain; ranged attacks against you in such conditions take −2 to hit.' }),
    F('Whale-Oil Lantern Kit', 'text', 'carried', { description: 'Flame can’t be extinguished by nonmagical wind/snow/rain; Advantage on sight Perception in snow/fog/freezing rain while lit.' }),
], '#06b6d4')

// 18. Currency.
S('Currency', 'currency', [
    F('GP', 'number', 346),
    F('SP', 'number', 0),
    F('CP', 'number', 0),
], '#f59e0b')

// 19. Equipment — mundane gear and consumables.
S('Equipment', 'default', [
    F('Studded Leather (worn), Shield (worn)', 'text', 'equipped'),
    F('Longbow + Arrows ×20', 'text', 'equipped'),
    F('Leather Armor (spare), Sickle', 'text', 'carried'),
    F('Staff (arcane focus), Component Pouch', 'text', 'carried'),
    F('Herbalism Kit, Healer’s Kit ×3', 'text', 'carried'),
    F('Backpack, Bedroll, Tent, Waterskin', 'text', 'carried'),
    F('Rations ×5, Rope, Climber’s Kit, Pole', 'text', 'carried'),
    F('Bullseye Lantern, Tinderbox, Torch ×10', 'text', 'carried'),
    F('Caltrops, Acid ×2, Antitoxin ×3', 'text', 'carried'),
    F('Dynamite ×2, Blasting Powder ×5', 'text', 'carried'),
    F('Sled, Military Saddle, Piton', 'text', 'carried'),
])

// Reading order: identity -> abilities -> checks -> defence/vitals -> offence ->
// magic -> traits -> resources/states -> info/inventory. Tidy and stack view
// follow this array order, so keep it logical.
const ORDER = [
    'Character', 'Ability Scores',
    'Saving Throws', 'Skills', 'Senses',
    'Combat', 'Hit Points', 'Death Saves',
    'Attacks', 'Spellcasting', 'Spell Slots', 'Cantrips', 'Prepared Spells',
    'Resources', 'Conditions', 'Features & Traits',
    'Languages', 'Notable Gear', 'Equipment', 'Currency',
]
sections.sort((a, b) => ORDER.indexOf(a.title) - ORDER.indexOf(b.title))
// Re-pack the default free-canvas layout so it follows the new order too.
colBottom.fill(Y0)
for (const s of sections) s.layout = place(s.fields, s.kind)

const sheet = { id: randomUUID(), name: 'Amarthon', sections }
writeFileSync(
    new URL('../samples/amarthon-sheet.json', import.meta.url),
    JSON.stringify(sheet, null, 2) + '\n',
)
console.log(`Wrote ${sections.length} sections.`)
