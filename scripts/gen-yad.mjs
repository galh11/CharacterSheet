// One-off generator: builds Yad Armhand's sheet in this app's native format,
// with every derivable value expressed as a computed field or a {formula}
// placeholder so nothing that depends on ability mods / proficiency is
// hand-typed. Run: `node scripts/gen-yad.mjs` -> samples/yad-armhand-sheet.json
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
    F('Race', 'text', 'Goliath (Hill Giant)'),
    F('Size', 'text', 'Medium (Large in Large Form)'),
    F('Class', 'text', 'Pugilist 8'),
    F('Level', 'number', 8, { description: 'Character level. Use “Level up” in the toolbar to increment, then update HP max, hit dice, and features.' }),
    F('Subclass', 'text', 'Squared Circle'),
    F('Background', 'text', 'Wayfarer'),
    F('Inspiration', 'boolean', 'false', { description: 'Spend to reroll any d20. Toggle from the star in the toolbar.' }),
    F('Armor', 'text', 'Light'),
    F('Weapons', 'text', 'Simple, Improvised, Pugilist (Brass Knuckles, Hand Claws, Punch Knife), Darts'),
    F('Tools', 'text', 'Thieves’ Tools, Gaming Set'),
], '#8b5cf6')

// 1. Ability scores. Each score has an editable computed modifier field
// (str_mod = floor((str-10)/2)); the ability cards display that value, and other
// formulas (AC, attacks, saves) reference the *_mod slugs.
S('Ability Scores', 'abilities', [
    F('STR', 'number', 20),
    F('DEX', 'number', 12),
    F('CON', 'number', 16),
    F('INT', 'number', 8),
    F('WIS', 'number', 13),
    F('CHA', 'number', 8),
    F('STR Mod', 'computed', 'floor((str - 10) / 2)'),
    F('DEX Mod', 'computed', 'floor((dex - 10) / 2)'),
    F('CON Mod', 'computed', 'floor((con - 10) / 2)'),
    F('INT Mod', 'computed', 'floor((int - 10) / 2)'),
    F('WIS Mod', 'computed', 'floor((wis - 10) / 2)'),
    F('CHA Mod', 'computed', 'floor((cha - 10) / 2)'),
], '#f59e0b')

// 2. Combat — AC, initiative, speed, passive perception. Ability modifiers
// (str_mod, con_mod, …) come straight from the Ability Scores section now, so
// there is no separate Modifiers section.
S('Combat', 'default', [
    F('AC', 'computed', '12 + con_mod', { description: 'Iron Chin: base AC = 12 + CON mod while in Light or no armor and no shield. DEX does not apply.' }),
    F('Initiative', 'computed', 'dex_mod'),
    F('Speed', 'number', 35, { description: 'Climb 35 ft (Athlete). +10 ft while in Large Form.' }),
    F('Passive Perception', 'computed', '10 + wis_mod'),
    F('Grapple / Shove DC', 'computed', '8 + str_mod + proficiency', { description: 'Targets make a STR or DEX save vs this DC. Inescapable (1 Moxie) imposes Disadvantage.' }),
    F('Proficiency', 'computed', 'floor((level - 1) / 4) + 2', { description: 'Proficiency bonus, derived from your level. Used by attacks, saves and skills.' }),
], '#ef4444')

// 3b. Movement & physique (all derived from Strength / Athlete / Powerful Build).
S('Movement & Physique', 'default', [
    F('Climb Speed', 'computed', 'speed', { description: 'Athlete: equal to your Speed.' }),
    F('Long Jump', 'computed', 'str', { description: 'Feet, with only a 5 ft run-up (Athlete).' }),
    F('High Jump', 'computed', '3 + str_mod', { description: 'Feet, with only a 5 ft run-up (Athlete).' }),
        F('Carrying Capacity', 'computed', 'str * 15', { description: 'lb. Powerful Build doubles this (it counts you as one size larger) — the doubling is granted by the Powerful Build trait.' }),
    F('Carried Weight', 'number', 0, { description: 'Total weight you are carrying (lb).' }),
    F('Load %', 'computed', 'floor(carried_weight / carrying_capacity * 100)', { description: 'Of carrying capacity. You are encumbered past 100%.' }),
], '#10b981')

// 4. Hit points. The Reinforced Studded Leather's flat physical-damage
// reduction is authored as a `note` effect ON THAT ARMOR ITEM (see Inventory)
// and surfaces here via the HP tracker, so the benefit stays attached to its
// source. The hit-dice pool lives here (tagged meta.die) and is spent via the
// Hit Dice popup rather than a section of its own; the HP widget doesn't render it.
S('Hit Points', 'hp', [
    F('Current HP', 'number', 76),
    F('Max HP', 'number', 76),
    F('Temp HP', 'number', 0),
    F('Concentration', 'boolean', 'false', { description: 'Toggle on when concentrating. Taking damage prompts a CON save (DC = half the damage, minimum 10).' }),
    F('Resistances', 'text', '', { description: 'Comma-separated damage types halved on the Damage button (manual override). Dig Deep adds bludgeoning/piercing/slashing automatically while active; the Reinforced Studded Leather’s flat −3 to physical damage shows here as a reminder note.' }),
    F('Vulnerabilities', 'text', '', { description: 'Comma-separated damage types doubled on the Damage button.' }),
    F('Hit Dice (d10)', 'resource', 8, { max: 8, meta: { die: 'd10', recharge: 'long' } }),
], '#10b981')

// 7. Saving throws (auto: ability mod + proficiency when proficient).
S('Saving Throws', 'skills', [
    skill('Strength', 'STR', 'proficient'),
    skill('Dexterity', 'DEX', 'none'),
    skill('Constitution', 'CON', 'proficient'),
    skill('Intelligence', 'INT', 'none'),
    skill('Wisdom', 'WIS', 'none'),
    skill('Charisma', 'CHA', 'none'),
], '#8b5cf6')

// 8. Skills (auto). Athletics has expertise; four proficiencies.
S('Skills', 'skills', [
    skill('Acrobatics', 'DEX', 'none'),
    skill('Animal Handling', 'WIS', 'none'),
    skill('Arcana', 'INT', 'none'),
    skill('Athletics', 'STR', 'expertise'),
    skill('Deception', 'CHA', 'none'),
    skill('History', 'INT', 'none'),
    skill('Insight', 'WIS', 'proficient'),
    skill('Intimidation', 'CHA', 'proficient'),
    skill('Investigation', 'INT', 'none'),
    skill('Medicine', 'WIS', 'none'),
    skill('Nature', 'INT', 'none'),
    skill('Perception', 'WIS', 'none'),
    skill('Performance', 'CHA', 'none'),
    skill('Persuasion', 'CHA', 'none'),
    skill('Religion', 'INT', 'none'),
    skill('Sleight of Hand', 'DEX', 'none'),
    skill('Stealth', 'DEX', 'proficient'),
    skill('Survival', 'WIS', 'none'),
], '#8b5cf6')

// 9. Attacks — to-hit and damage derived from STR mod + proficiency + fisticuffs die.
S('Attacks', 'actions', [
    F('Unarmed Strike', 'text', '', {
        description: 'Fisticuffs die d10. Moxie-Fueled Fists: may deal Force instead. Heavy Hitter: also Grapple or Shove on a hit. Hill’s Tumble: knock a Large-or-smaller target Prone (3/Long).',
        meta: { hit: '+{str_mod + proficiency}', damage: '1d10+{str_mod + down_but_not_out * (con_mod + exhaustion)}', type: 'bludgeoning', range: '5 ft' },
    }),
    F('Flame Tongue Handaxe', 'text', '', {
        description: 'Uses the d10 fisticuffs die. Ignite as a Bonus Action with the 🔥 Flame Tongue toggle to add 2d6 fire.',
        meta: { hit: '+{str_mod + proficiency}', damage: '1d10+{str_mod + down_but_not_out * (con_mod + exhaustion)}', type: 'slashing', range: '20/60' },
        toggles: [
            {
                id: randomUUID(),
                label: 'Flame Tongue',
                active: false,
                field: 'flame_tongue',
                hitMode: 'add',
                hit: '',
                parts: [{ mode: 'add', damage: '2d6', type: 'fire' }],
                setType: '',
                description: 'Ignite as a Bonus Action: +2d6 fire on hits; sheds Bright Light 40 ft. Linked to the flame_tongue state, so the Ignite bonus action flips it too.',
            },
        ],
    }),
    F('Javelin', 'text', '', {
        description: 'Thrown weapon (uses the d10 fisticuffs die).',
        meta: { hit: '+{str_mod + proficiency}', damage: '1d10+{str_mod + down_but_not_out * (con_mod + exhaustion)}', type: 'piercing', range: '30/120' },
    }),
    F('Compression Lock', 'text', '', {
        description: 'Start of your turn: each creature you have Grappled takes this Bludgeoning damage.',
        meta: { damage: '1d10+{str_mod + down_but_not_out * (con_mod + exhaustion)}', type: 'bludgeoning' },
    }),
], '#f59e0b')

// 10. Bonus actions.
S('Bonus Actions', 'actions', [
    F('Ignite Flame Tongue', 'text', '', {
        description: 'Bonus Action: ignite or quench the Flame Tongue Handaxe. Bound to the same flame_tongue state as the 🔥 toggle on the Handaxe attack, so flipping it in either place updates the other (and the +2d6 fire).',
        toggles: [
            {
                id: randomUUID(),
                label: 'Lit',
                active: false,
                field: 'flame_tongue',
                hitMode: 'add',
                hit: '',
                parts: [],
                setType: '',
                description: 'Ignite / quench the Flame Tongue (shared with the Handaxe toggle).',
            },
        ],
    }),
    F('Bonus Unarmed Strike', 'text', '', {
        description: 'You can make an Unarmed Strike as a Bonus Action.',
        meta: { hit: '+{str_mod + proficiency}', damage: '1d10+{str_mod + down_but_not_out * (con_mod + exhaustion)}', type: 'bludgeoning', range: '5 ft' },
    }),
    F('Haymaker', 'text', '', {
        description: 'On a hit, deal maximum damage and regain the Moxie Point.',
        meta: { cost: '1', costField: 'moxie_points', costLabel: 'Moxie' },
    }),
    F('One-Two Punch', 'text', '', {
        description: 'Make two Unarmed Strikes as a Bonus Action.',
        meta: { cost: '1', costField: 'moxie_points', costLabel: 'Moxie' },
    }),
    F('Stick and Move', 'text', '', {
        description: 'Make an Unarmed Strike and Dash or Disengage.',
        meta: { cost: '1', costField: 'moxie_points', costLabel: 'Moxie' },
    }),
    F('Brace Up', 'text', '', {
        description: 'Temp HP = fisticuffs die + level + CON mod. Costs 1 Moxie.',
        meta: { cost: '1', costField: 'moxie_points', costLabel: 'Moxie', temp: '1d10 + {level + con_mod}' },
    }),
    F('Large Form', 'text', '', {
        description: 'Become Large 10 min: advantage on STR checks, +10 ft Speed.',
        meta: { cost: '1', costField: 'large_form', costLabel: 'use' },
    }),
    F('Dig Deep', 'text', '', {
        description: '10 min: resistance to Bludgeoning/Piercing/Slashing; ignore exhaustion < 6. Restore by gaining 1 exhaustion.',
        meta: { cost: '1', costField: 'dig_deep', costLabel: 'use', refill: 'dig_deep', refillCost: 'exhaustion', refillLabel: 'Dig Deep', refillCostLabel: 'Exhaustion' },
    }),
], '#06b6d4')

// 11. Reactions.
S('Reactions', 'actions', [
    F('Bloodied But Unbowed', 'text', '', {
        description: 'When you take damage: regain all Moxie. If Bloodied, gain Temp HP = 4 × level. Once per Short/Long Rest.',
        meta: { cost: '1', costField: 'bloodied_but_unbowed', costLabel: 'use', temp: '{4 * level}' },
    }),
    F('Meat Shield', 'text', '', {
        description: 'When a creature misses you, force it to reroll against a creature you are Grappling. Costs 1 Moxie.',
        meta: { cost: '1', costField: 'moxie_points', costLabel: 'Moxie' },
    }),
])

// 12. Features & traits (level 8: core Pugilist + Squared Circle + race + feats).
S('Features & Traits', 'actions', [
    F('Fisticuffs', 'text', '', { description: 'Unarmed/Pugilist-weapon damage die is d10; bonus-action Unarmed Strike. Improved Improvisation: improvised weapons count as having the Sap mastery for you (on a hit, the target has Disadvantage on its next attack before your next turn). You have no other weapon masteries.' }),
    F('Iron Chin', 'text', '', { description: 'Base AC = 12 + CON mod while in Light or no armor and no shield.' }),
    F('Heavy Hitter', 'text', '', { description: 'On an Unarmed Strike hit: deal Damage AND your choice of Grapple or Shove.' }),
    F('Extra Attack', 'text', '', { description: 'Attack twice whenever you take the Attack action.' }),
    F('Moxie-Fueled Fists', 'text', '', { description: 'Unarmed/improvised damage may be Force instead of its normal type.' }),
    F('Swagger Streak (1/Short)', 'text', '', { description: 'On a failed STR/DEX/CON/CHA check, spend 1 Moxie and add 1d10; may turn a failure into success.' }),
    F('Down But Not Out (1/Long)', 'text', '', { description: 'With Bloodied But Unbowed while Bloodied: +damage = CON mod + exhaustion levels for 1 min.' }),
    F('Groundwork (Squared Circle)', 'text', '', { description: 'Compression Lock (grappled foes take fisticuffs + STR each turn), Inescapable (1 Moxie: Disadvantage on escapes), Stop and Drop (Unarmed hit without mastery: Grapple AND Shove).' }),
    F('Muscle Mass (Squared Circle)', 'text', '', { description: 'Expertise in Athletics (already included in the +11).' }),
    F('Meat Shield (Squared Circle)', 'text', '', { description: 'While grappling: Half Cover vs others. Reaction + 1 Moxie: redirect a creature’s miss onto a creature you are Grappling.' }),
    F('Giant Ancestry — Hill’s Tumble', 'text', '', { description: 'On a hit that damages a Large-or-smaller creature: knock it Prone. Uses = proficiency (3) per Long Rest.' }),
    F('Large Form (1/Long)', 'text', '', { description: 'Bonus Action: become Large for 10 min — Advantage on STR checks, +10 ft Speed.' }),
    F('Powerful Build', 'text', '', {
        description: 'Advantage on checks to end the Grappled condition; count as one size larger for carrying capacity.',
        effects: [{ target: 'carrying_capacity', op: 'set', value: 'str * 15 * 2' }],
    }),
    F('Lucky (feat)', 'text', '', { description: 'Spend a Luck Point for Advantage, or impose Disadvantage on an attack against you (3/Long).' }),
    F('Athlete (feat)', 'text', '', { description: 'Climb Speed = Speed; stand from Prone with 5 ft; run-up jumps after 5 ft.' }),
])

// 13. Resources (rest-aware pips).
S('Resources', 'default', [
    F('Moxie Points', 'resource', 5, { max: 5, meta: { recharge: 'short' } }),
    F('Luck Points', 'resource', 3, { max: 3, meta: { recharge: 'long' } }),
    F("Hill's Tumble", 'resource', 3, { maxFormula: 'proficiency', meta: { recharge: 'long' } }),
    F('Large Form', 'resource', 1, { max: 1, meta: { recharge: 'long' } }),
    F('Dig Deep', 'resource', 1, { max: 1, meta: { recharge: 'long' } }),
    F('Bloodied But Unbowed', 'resource', 1, { max: 1, meta: { recharge: 'short' } }),
    F('Swagger Streak', 'resource', 1, { max: 1, meta: { recharge: 'short' } }),
    F('Exhaustion', 'counter', 0, { max: 6 }),
], '#ec4899')

// 14. Buffs & states — self-managed on/off toggles (weapon states, class buffs);
// NOT status conditions. Flame Tongue is bound to the Handaxe + Ignite toggles.
S('Buffs & States', 'conditions', [
    F('Flame Tongue', 'boolean', 'false', { description: 'Handaxe ignited (Bonus Action): sheds Bright Light 40 ft and its attack adds +2d6 fire. Toggle it here, from the 🔥 button on the Handaxe attack, or the Ignite Flame Tongue bonus action — all stay in sync.' }),
    F('Down But Not Out', 'boolean', 'false', { description: 'While active, your Unarmed/Pugilist-weapon damage gains +CON mod + exhaustion levels (auto-added to attack damage).' }),
    F('Large Form', 'boolean', 'false', {
        description: 'Large: advantage on STR checks, +10 ft Speed.',
        effects: [{ target: 'speed', op: 'add', value: '10' }],
    }),
    F('Dig Deep', 'boolean', 'false', {
        description: 'Resistance to Bludgeoning/Piercing/Slashing; ignore exhaustion < 6.',
        effects: [
            { target: 'defenses', op: 'resist', value: 'bludgeoning' },
            { target: 'defenses', op: 'resist', value: 'piercing' },
            { target: 'defenses', op: 'resist', value: 'slashing' },
        ],
    }),
    F('Grappling', 'boolean', 'false', { description: 'Compression Lock hits grappled foes each turn.' }),
], '#f97316')

// 15. Conditions & states.
S('Conditions', 'conditions', [
    F('Bloodied', 'boolean', 'false', { description: 'At or below half your Max HP. Auto-set by the HP tracker.' }),
    F('Prone', 'boolean', 'false'),
    F('Grappled', 'boolean', 'false'),
    F('Frightened', 'boolean', 'false'),
    F('Poisoned', 'boolean', 'false'),
    F('Stunned', 'boolean', 'false'),
], '#ef4444')

// 15. Senses.
S('Senses', 'default', [
    F('Darkvision', 'text', '15 ft'),
    F('Passive Perception', 'computed', '10 + wis_mod'),
    F('Passive Insight', 'computed', '10 + wis_mod + proficiency'),
])

// 16. Languages.
S('Languages', 'default', [
    F('Common', 'text', 'fluent'),
    F('Giant', 'text', 'fluent'),
    F('Elvish', 'text', 'fluent'),
])

// 17. Inventory — one D&D-Beyond-style section: coin purse at the top (Bone
// Marks is a homebrew denomination), then the gear from Yad's export (some carry
// custom names/notes) and mundane equipment together.
S('Inventory', 'inventory', [
    F('Bone Marks', 'number', 108, { description: 'Homebrew currency.', meta: { coin: 'bones' } }),
    F('GP', 'number', 0, { meta: { coin: 'gp' } }),
    F('Flame Tongue Handaxe', 'text', 'equipped', { description: '+2d6 fire while ablaze (Bonus Action to ignite). Sheds Bright Light 40 ft.' }),
    F('Reinforced Studded Leather', 'text', 'worn', {
        description: 'Reduce physical (bludgeoning/piercing/slashing) damage you take by 3. Shown as a reminder note on the HP tracker; unequip (toggle its effect off) to drop it.',
        effects: [{ target: 'damage_reduction', op: 'note', value: 'Physical damage taken reduced by 3' }],
    }),
    F('Dark Adaptation Helmet', 'text', 'worn', {
        description: 'Grants Darkvision 15 ft.',
        effects: [{ target: 'darkvision', op: 'note', value: 'Darkvision 15 ft' }],
    }),
    F('Snow-Shell Boots', 'text', 'worn', { description: 'Snow/ice isn’t difficult terrain; Advantage on checks/saves vs slipping, falling Prone, or forced movement on ice.' }),
    F('Layered Cold Cloak', 'text', 'worn', { description: 'Advantage on saves vs extreme cold; on gaining cold Exhaustion, roll d6 — on a 6 you don’t gain it.' }),
    F('Horizon Society Salvage Harness', 'text', 'worn', { description: 'Carrying capacity doubled; 1/Long Rest, negate a level of Exhaustion from travel, marching, climbing, or environment.' }),
    F('Reinforced Rope Coil', 'text', 'carried', { description: 'Advantage on Athletics (STR) to climb or prevent a fall; immune to cold; 10 HP.' }),
    F('Ice-Anchor Pitons', 'text', '×10', { description: 'Secure a rope for Advantage on Athletics climbing; anchor holds 2,000 lb.' }),
    F('Potion of Healing (Greater)', 'text', '×5', { description: 'Regain 4d4 + 4 HP.' }),
    F('Potion of Healing (Superior)', 'text', '×3', { description: 'Regain 8d4 + 8 HP.' }),
    F('Javelins', 'text', '×3'),
    F('Thieves’ Tools', 'text', 'carried'),
    F('Manacles, Chain ×2, Grappling Hook', 'text', 'carried'),
    F('Caltrops, Oil ×2, Torches ×10', 'text', 'carried'),
    F('Bullseye Lantern, Tinderbox', 'text', 'carried'),
    F('Rations ×10, Waterskin', 'text', 'carried'),
    F('Climber’s Kit, Crowbar, Pole, Rope', 'text', 'carried'),
], '#a3a3a3')

// Reading order: identity → abilities → ability-derived → defence/vitals →
// offence → resources & states → traits → movement/info/inventory. Tidy and
// stack view follow this array order, so keep it logical.
const ORDER = [
    'Character', 'Ability Scores',
    'Saving Throws', 'Skills', 'Senses',
    'Combat', 'Hit Points', 'Death Saves',
    'Attacks', 'Bonus Actions', 'Reactions',
    'Resources', 'Buffs & States', 'Conditions', 'Features & Traits',
    'Movement & Physique', 'Languages', 'Inventory',
]
sections.sort((a, b) => ORDER.indexOf(a.title) - ORDER.indexOf(b.title))
// Re-pack the default free-canvas layout so it follows the new order too.
colBottom.fill(Y0)
for (const s of sections) s.layout = place(s.fields, s.kind)

const sheet = { id: randomUUID(), name: 'Yad Armhand', sections }
writeFileSync(
    new URL('../samples/yad-armhand-sheet.json', import.meta.url),
    JSON.stringify(sheet, null, 2) + '\n',
)
console.log(`Wrote ${sections.length} sections.`)

