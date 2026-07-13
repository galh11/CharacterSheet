# Amarthon — Digest

## Identity
- **Amarthon** — Variant Human — Druid 8 (Circle of the Moon) — Background: Sage — Lawful Neutral (alignmentId 5)
- Proficiency bonus **+3**; size Medium; walking speed **30 ft** (no fly/swim/climb/burrow)
- Faith: The Moon-Wheel of the Golden Dawn (Auril). Male, age 375.
- **Armor prof:** Light armor, Shields. **Weapons:** Simple weapons. **Tools:** Herbalism Kit, Calligrapher's Supplies.
- **Languages:** Common, Druidic (+ others, flavor).

## Ability scores (score — derivation)
- **STR 8** (base 8) → **-1**
- **DEX 14** (base 14) → **+2**
- **CON 17** (base 14 +1 Variant Human racial +2 Sage ASI) → **+3**
- **INT 10** (base 10) → **0**
- **WIS 19** (base 15 +1 Variant Human racial +1 Sage ASI +1 War Caster +1 Fey Touched) → **+4**  ← key stat
- **CHA 10** (base 10) → **0**
- Spellcasting ability: **WIS** (Druid). Feat spells also set to **WIS**.

## Defenses & vitals
- **Max HP = 67** = baseHitPoints 43 + con_mod(+3)×8
- **Hit dice:** 8d8
- **AC = 16** = Studded Leather 12 + DEX mod (+2) + Shield 2 (both equipped)
  - Situational: knows **Barkskin** (floors AC at 17 while active → relational `min ac 17`) and **Mage Armor** — but base worn AC is Studded Leather + Shield.
- **Initiative = +2** (DEX)
- **Passive Perception 17** (10 + WIS 4 + prof 3; has advantage — see skills); **Passive Insight 17**; **Passive Investigation 10**
- Resistances: cold (environmental only, via Deep North Expedition Cloak). No innate darkvision.
- Concentration: **advantage on CON saves to maintain concentration** (War Caster).

## Saving throws & skills
- **Proficient saves:** INT, WIS
- **Proficient skills:** Arcana, History (Sage background); Perception, Insight (Druid); Nature (Variant Human bonus skill)
- **Always-on skill advantage** (from `characterValues` typeId 23 + item notes):
  - **Animal Handling** — advantage (Amulet "Beast Whisper" + typeId 23 v11)
  - **Perception** — advantage (typeId 23 v14; also while carrying lit Whale-Oil Lantern)
  - **Performance** — advantage (typeId 23 v15)

## Attacks / actions (name — to-hit — damage — notes)
- **Quarterstaff** — +{str_mod + proficiency} — 1d6 (1d8 versatile) bludgeoning — melee. This is the renamed **"Quarterstaff - True Strike Echo"**: note *"You can gain advantage on one attack roll (1/long rest)."*
  - **Shillelagh toggle** (cantrip): quarterstaff/club uses **WIS** for attack & damage, damage die → 1d8 (scales). → action toggle.
- **Sickle** — +{str_mod + proficiency} — 1d4 slashing — melee (not equipped)
- **Longbow** — +{dex_mod + proficiency} — 1d8+{dex_mod} piercing — range 150/600 (equipped; 20 arrows)
- **Elemental Fury** (Primal Strike, L7): once per turn on a hit (weapon or Wild Shape attack) add **1d8 elemental** damage. → on-hit rider / action toggle.

## Spellcasting
- **Spell save DC = 15** (8 + prof 3 + WIS 4); **Spell attack = +7** (prof 3 + WIS 4); ability **WIS**
- **Spell slots (Druid 8):** L1 ×4 · L2 ×3 · L3 ×3 · L4 ×2
- **Cantrips known (Druid):** Message, Shillelagh, Poison Spray, **Guidance** (Guidance = Primal Order "Magician" bonus cantrip)
- **Prepared Druid spells (by level):**
  - L1: Absorb Elements, Detect Magic, Healing Word
  - L2: Pass without Trace, Aid, Barkskin
  - L3: Dispel Magic, Revivify, Syluné's Viper
  - L4: Polymorph, Wall of Fire, Fire Shield
- **Always-prepared — Circle of the Moon Spells (L8 tier):** Cure Wounds, Moonbeam, Starry Wisp, Conjure Animals, Fount of Moonlight
- **Always-prepared — Druidic:** Speak with Animals
- **Feat spells (all WIS-based):**
  - Magic Initiate (Wizard): cantrips Minor Illusion, Booming Blade; L1 Find Familiar; L1 Shield
  - Fey Touched: L2 Misty Step (always), L1 Silvery Barbs (always)

## Features & traits (name — one-line effect)
**Druid (class):**
- Spellcasting — WIS caster, prepared (above)
- Druidic — secret language; grants **Speak with Animals** always prepared
- **Primal Order → Magician** — +1 Druid cantrip (Guidance) **AND** bonus = wis_mod (min +1) to **INT (Arcana) and INT (Nature)** checks. → **relational effect:** `add +4 to arcana` and `add +4 to nature` (folds into those skill mods)
- **Wild Shape** — transform; **Circle Forms** set Wild Shape AC = 13 + wis_mod (**17**) and Temp HP = 3 × druid level (**24**). Uses tracked as resource (below)
- Wild Companion — expend a Wild Shape use to cast Find Familiar (ritual, fey spirit)
- Druid Subclass — Circle of the Moon
- ASI (L4, L8) — folded into ability scores above (War Caster / Fey Touched taken as feats)
- Wild Resurgence — regain 1 Wild Shape use on a turn by expending a spell slot; or 1/long rest expend Wild Shape → regain a 1st-level slot (resource below)
- Elemental Fury (L7, Primal Strike option) — once per turn add 1d8 elemental damage on a hit (see attacks)

**Circle of the Moon (subclass):**
- Circle Forms — Wild Shape AC 13 + wis_mod; Temp HP 3 × level
- Circle of the Moon Spells — always-prepared list (above)
- **Improved Circle Forms (L6)** — Lunar Radiance: deal radiant instead of normal Wild Shape attack damage; **add wis_mod to CON saving throws**. → **relational effect:** `add +4 to constitution_save` (Lunar Radiance radiant is a Wild Shape damage option)

**Feats:**
- War Caster — advantage on concentration CON saves; cast with hands full; can cast a spell as an opportunity attack
- Magic Initiate (Wizard) — feat spells above (WIS)
- Fey Touched — +1 WIS; Misty Step + Silvery Barbs (WIS)

**Background (Sage):** proficiencies Arcana + History; ASI +2 CON / +1 WIS

## Resources (limited uses)
- **Wild Shape** — max **3** — recharge: regain **1 on short rest**, **all on long rest** — fuels transforming (Circle Forms / Wild Companion)
- **Wild Resurgence: Regain Spell Slot** — max **1** — recharge: **long rest** — expend a Wild Shape use to regain one 1st-level spell slot
- (Circle Forms / Improved Circle Forms are passive; Moonlight Step is a level-10 feature — **excluded**, character is level 8.)

## Inventory & coins
- **Coins:** GP **346** (all others 0)
- **Equipped / worn magic & key gear:**
  - **Ring of Quick Recovery** (renamed Adventurer's Ring, equipped) — *"When you regain hit points, you regain an additional 3 hit points (once per turn)."*
  - **Amulet - Beast Whisper** — *"You have advantage on Wisdom (Animal Handling) checks."*
  - **Quarterstaff - True Strike Echo** (equipped) — *"You can gain advantage on one attack roll (1/long rest)."*
  - Studded Leather (equipped, AC 12), Shield (equipped, AC 2), Longbow + 20 Arrows (equipped)
- **Custom items (`customItems`):**
  - **Deep North Expedition Cloak** — resistance to cold damage from environmental effects (not spells/attacks)
  - **Storm Hood of Kaldweave** — see normally through nonmagical snow/fog/freezing rain; ranged bonus vs weather
  - **Whale-Oil Lantern Kit** — flame can't be blown out by nonmagical weather; advantage on WIS (Perception) while carrying it lit
- **Spell scrolls (renamed):** Spell Scroll - Fire Ball (note "8d6") ×2, Spell Scroll - Counterspell ×2, Spell Scroll - Slow ×2
- **Consumables:** Potion of Healing (Greater) ×3, Potion of Healing (Superior) ×4, Antitoxin ×3, Acid vial ×2, Healer's Kit ×3
- **Tools/kits:** Herbalism Kit, Component Pouch, Climber's Kit, Calligrapher's Supplies (prof), Tinderbox
- **Mundane gear (grouped):** Backpack, Bedroll, Tent, Rope ×2, Rations ×5, Torch ×10, Waterskin, Sled, Military Saddle, Pole, Oil ×2, Caltrops ×40, Piton, Perfume ×5, Bullseye Lantern, Staff, Leather armor (spare), plus explosives (Blasting Powder ×5, Dynamite ×4)

## Conditions / misc
- Inspiration: **none**. No starting conditions.
- Concentration reminder: War Caster gives advantage on CON saves to maintain it.
