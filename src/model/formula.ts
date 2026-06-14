/**
 * A tiny, safe arithmetic formula evaluator for computed fields.
 *
 * Supports:
 *  - numbers, + - * / %, parentheses, unary minus
 *  - identifiers resolved from a scope (field slugs)
 *  - helper functions: floor, ceil, round, abs, min, max, sqrt
 *
 * It does NOT use eval/Function, so arbitrary code cannot run.
 */

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    abs: Math.abs,
    sqrt: Math.sqrt,
    min: Math.min,
    max: Math.max,
}

type Token =
    | { kind: 'number'; value: number }
    | { kind: 'ident'; value: string }
    | { kind: 'op'; value: string }
    | { kind: 'paren'; value: '(' | ')' }
    | { kind: 'comma' }

const tokenize = (input: string): Token[] => {
    const tokens: Token[] = []
    let i = 0
    while (i < input.length) {
        const ch = input[i]
        if (ch === ' ' || ch === '\t' || ch === '\n') {
            i++
            continue
        }
        if (ch >= '0' && ch <= '9') {
            let num = ''
            while (i < input.length && /[0-9.]/.test(input[i])) {
                num += input[i]
                i++
            }
            tokens.push({ kind: 'number', value: Number(num) })
            continue
        }
        if (/[a-zA-Z_]/.test(ch)) {
            let id = ''
            while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
                id += input[i]
                i++
            }
            tokens.push({ kind: 'ident', value: id })
            continue
        }
        if ('+-*/%'.includes(ch)) {
            tokens.push({ kind: 'op', value: ch })
            i++
            continue
        }
        if (ch === '(' || ch === ')') {
            tokens.push({ kind: 'paren', value: ch })
            i++
            continue
        }
        if (ch === ',') {
            tokens.push({ kind: 'comma' })
            i++
            continue
        }
        throw new Error(`Unexpected character: ${ch}`)
    }
    return tokens
}

/** Recursive-descent parser/evaluator over the token stream. */
class Parser {
    private pos = 0
    constructor(
        private readonly tokens: Token[],
        private readonly scope: Record<string, number>,
    ) {}

    evaluate(): number {
        const value = this.parseExpression()
        if (this.pos < this.tokens.length) {
            throw new Error('Unexpected trailing input')
        }
        return value
    }

    private peek(): Token | undefined {
        return this.tokens[this.pos]
    }

    private parseExpression(): number {
        let left = this.parseTerm()
        let token = this.peek()
        while (token && token.kind === 'op' && (token.value === '+' || token.value === '-')) {
            this.pos++
            const right = this.parseTerm()
            left = token.value === '+' ? left + right : left - right
            token = this.peek()
        }
        return left
    }

    private parseTerm(): number {
        let left = this.parseFactor()
        let token = this.peek()
        while (
            token &&
            token.kind === 'op' &&
            (token.value === '*' || token.value === '/' || token.value === '%')
        ) {
            this.pos++
            const right = this.parseFactor()
            if (token.value === '*') left = left * right
            else if (token.value === '/') left = left / right
            else left = left % right
            token = this.peek()
        }
        return left
    }

    private parseFactor(): number {
        const token = this.peek()
        if (!token) throw new Error('Unexpected end of expression')

        if (token.kind === 'op' && token.value === '-') {
            this.pos++
            return -this.parseFactor()
        }
        if (token.kind === 'op' && token.value === '+') {
            this.pos++
            return this.parseFactor()
        }
        if (token.kind === 'number') {
            this.pos++
            return token.value
        }
        if (token.kind === 'paren' && token.value === '(') {
            this.pos++
            const value = this.parseExpression()
            const close = this.peek()
            if (!close || close.kind !== 'paren' || close.value !== ')') {
                throw new Error('Expected )')
            }
            this.pos++
            return value
        }
        if (token.kind === 'ident') {
            this.pos++
            const next = this.peek()
            if (next && next.kind === 'paren' && next.value === '(') {
                // function call
                this.pos++
                const args: number[] = []
                if (!(this.peek()?.kind === 'paren' && (this.peek() as { value: string }).value === ')')) {
                    args.push(this.parseExpression())
                    while (this.peek()?.kind === 'comma') {
                        this.pos++
                        args.push(this.parseExpression())
                    }
                }
                const close = this.peek()
                if (!close || close.kind !== 'paren' || close.value !== ')') {
                    throw new Error('Expected ) after arguments')
                }
                this.pos++
                const fn = FUNCTIONS[token.value]
                if (!fn) throw new Error(`Unknown function: ${token.value}`)
                return fn(...args)
            }
            const resolved = this.scope[token.value]
            if (resolved === undefined) {
                throw new Error(`Unknown identifier: ${token.value}`)
            }
            return resolved
        }
        throw new Error('Unexpected token')
    }
}

export interface FormulaResult {
    ok: boolean
    value: number | null
    error: string | null
}

/**
 * Evaluate a formula expression against a scope of field slugs -> numbers.
 */
export const evaluateFormula = (
    expression: string,
    scope: Record<string, number>,
): FormulaResult => {
    if (!expression.trim()) {
        return { ok: false, value: null, error: 'Empty formula' }
    }
    try {
        const tokens = tokenize(expression)
        const value = new Parser(tokens, scope).evaluate()
        if (Number.isNaN(value) || !Number.isFinite(value)) {
            return { ok: false, value: null, error: 'Result is not a finite number' }
        }
        return { ok: true, value, error: null }
    } catch (error) {
        return {
            ok: false,
            value: null,
            error: error instanceof Error ? error.message : 'Invalid formula',
        }
    }
}
