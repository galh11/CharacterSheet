import { describe, expect, it } from 'vitest'
import {
    parseRoll,
    rollExpr,
    rollD20,
    rollD20Series,
    rollDamage,
    critDamage,
    parseModifier,
    formatRoll,
    type Rng,
} from './dice'

/** Deterministic RNG: replays the given [0,1) values in order, then repeats. */
const seq = (values: number[]): Rng => {
    let i = 0
    return () => values[i++ % values.length]
}

/** RNG that always yields the die's maximum face. */
const max: Rng = () => 0.999999
/** RNG that always yields 1. */
const min: Rng = () => 0

describe('parseRoll', () => {
    it('parses count, sides and modifier', () => {
        expect(parseRoll('2d6+3')).toEqual({ dice: [{ count: 2, sides: 6 }], modifier: 3 })
    })

    it('defaults an omitted count to one and handles negatives', () => {
        expect(parseRoll('d20-1')).toEqual({ dice: [{ count: 1, sides: 20 }], modifier: -1 })
    })

    it('sums multiple dice terms and modifiers', () => {
        expect(parseRoll('1d6 + 1d4 + 2')).toEqual({
            dice: [
                { count: 1, sides: 6 },
                { count: 1, sides: 4 },
            ],
            modifier: 2,
        })
    })
})

describe('rollExpr', () => {
    it('rolls each die and adds the modifier', () => {
        // two d6 -> faces 4 and 6, plus 3
        const rng = seq([(4 - 1) / 6, (6 - 1) / 6])
        const r = rollExpr('2d6+3', rng)
        expect(r.rolls.map((d) => d.value)).toEqual([4, 6])
        expect(r.total).toBe(13)
        expect(r.expr).toBe('2d6+3')
    })

    it('honours min and max RNG bounds', () => {
        expect(rollExpr('1d20', min).total).toBe(1)
        expect(rollExpr('1d20', max).total).toBe(20)
    })
})

describe('rollD20', () => {
    it('adds the modifier and flags a natural 20 as a crit hit', () => {
        const r = rollD20(5, 'normal', max)
        expect(r.natural).toBe(20)
        expect(r.total).toBe(25)
        expect(r.crit).toBe('hit')
    })

    it('flags a natural 1 as a crit miss', () => {
        expect(rollD20(5, 'normal', min).crit).toBe('miss')
    })

    it('takes the higher of two dice on advantage', () => {
        const r = rollD20(0, 'advantage', seq([(7 - 1) / 20, (15 - 1) / 20]))
        expect(r.rolls).toEqual([7, 15])
        expect(r.natural).toBe(15)
    })

    it('takes the lower of two dice on disadvantage', () => {
        const r = rollD20(0, 'disadvantage', seq([(7 - 1) / 20, (15 - 1) / 20]))
        expect(r.natural).toBe(7)
    })
})

describe('rollDamage', () => {
    it('rolls each typed part and totals them', () => {
        const dmg = rollDamage([
            { expr: '1d6', type: 'piercing' },
            { expr: '1d4', type: 'fire' },
        ], max)
        expect(dmg.parts.map((p) => p.type)).toEqual(['piercing', 'fire'])
        expect(dmg.total).toBe(6 + 4)
    })

    it('skips blank expressions', () => {
        const dmg = rollDamage([{ expr: '', type: 'fire' }, { expr: '1d4' }], max)
        expect(dmg.parts).toHaveLength(1)
    })
})

describe('critDamage', () => {
    it('doubles the dice but not the flat modifier in RAW mode', () => {
        expect(critDamage('2d6+3', 'double-dice')).toBe('4d6+3')
        expect(critDamage('1d10', 'double-dice')).toBe('2d10')
        expect(critDamage('d8+1', 'double-dice')).toBe('2d8+1')
    })

    it('adds the maximised dice as a flat bonus in max-plus-roll mode', () => {
        // 2d6 max = 12 -> keep the dice, add +12 on top of the existing +3.
        expect(critDamage('2d6+3', 'max-plus-roll')).toBe('2d6+3+12')
        expect(critDamage('1d10', 'max-plus-roll')).toBe('1d10+10')
    })

    it('max-plus-roll totals to max dice + a rolled set + the modifier', () => {
        // 2d6+3 crit: 12 (maxed) + rolled 2d6 (min here = 2) + 3 = 17.
        const r = rollExpr(critDamage('2d6+3', 'max-plus-roll'), min)
        expect(r.total).toBe(12 + 2 + 3)
    })

    it('leaves a flat-only expression unchanged in max-plus-roll mode', () => {
        expect(critDamage('5', 'max-plus-roll')).toBe('5')
    })

    it('defaults to RAW double-dice', () => {
        expect(critDamage('2d6+3')).toBe('4d6+3')
    })
})

describe('rollD20Series', () => {
    it('rolls the requested count, adding a fresh bonus die each time', () => {
        // per iteration: one d20 then one d4
        const rng = seq([(10 - 1) / 20, (2 - 1) / 4, (15 - 1) / 20, (4 - 1) / 4, (1 - 1) / 20, 0])
        const s = rollD20Series(2, 'normal', 3, 4, rng)
        expect(s.results).toHaveLength(3)
        expect(s.results[0].total).toBe(10 + 2 + 2) // nat 10 + mod 2 + d4(2)
        expect(s.best).toBe(Math.max(...s.results.map((r) => r.total)))
    })

    it('defaults to a single roll with no bonus die', () => {
        const s = rollD20Series(5, 'normal', 1, 0, max)
        expect(s.results).toHaveLength(1)
        expect(s.results[0].total).toBe(25)
        expect(s.results[0].bonusDie).toBe(0)
    })
})

describe('parseModifier', () => {
    it('reads a leading signed integer', () => {
        expect(parseModifier('+5 to hit')).toBe(5)
        expect(parseModifier('-1')).toBe(-1)
        expect(parseModifier(undefined)).toBe(0)
    })
})

describe('formatRoll', () => {
    it('renders dice, modifier and total', () => {
        const r = rollExpr('2d6+3', seq([(4 - 1) / 6, (6 - 1) / 6]))
        expect(formatRoll(r)).toBe('[4, 6] + 3 = 13')
    })
})
