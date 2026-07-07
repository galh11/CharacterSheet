import { describe, expect, it } from 'vitest'
import {
    parseRoll,
    rollExpr,
    rollD20,
    rollDamage,
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
