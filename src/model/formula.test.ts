import { describe, it, expect } from 'vitest'
import { evaluateFormula } from './formula'

// Pure-logic tests: no DOM needed. These are the fastest, simplest tests to
// write and a good place to start when learning.
describe('evaluateFormula', () => {
    it('evaluates basic arithmetic with precedence', () => {
        const result = evaluateFormula('2 + 3 * 4', {})
        expect(result.ok).toBe(true)
        expect(result.value).toBe(14)
    })

    it('resolves identifiers from the scope', () => {
        const result = evaluateFormula('floor((str - 10) / 2)', { str: 16 })
        expect(result.ok).toBe(true)
        expect(result.value).toBe(3)
    })

    it('reports an error for an empty formula', () => {
        const result = evaluateFormula('   ', {})
        expect(result.ok).toBe(false)
        expect(result.value).toBeNull()
    })

    it('reports an error for invalid syntax instead of throwing', () => {
        const result = evaluateFormula('2 +', {})
        expect(result.ok).toBe(false)
        expect(result.error).not.toBeNull()
    })

    it('supports modulo and unary minus', () => {
        expect(evaluateFormula('10 % 3', {}).value).toBe(1)
        expect(evaluateFormula('-5 + 2', {}).value).toBe(-3)
    })

    it('supports nested helper functions', () => {
        const result = evaluateFormula('max(1, min(4, 9))', {})
        expect(result.ok).toBe(true)
        expect(result.value).toBe(4)
    })

    it('errors on an unknown identifier', () => {
        const result = evaluateFormula('foo + 1', {})
        expect(result.ok).toBe(false)
        expect(result.error).toContain('Unknown identifier')
    })

    it('errors on a non-finite result like division by zero', () => {
        const result = evaluateFormula('1 / 0', {})
        expect(result.ok).toBe(false)
        expect(result.value).toBeNull()
    })
})
