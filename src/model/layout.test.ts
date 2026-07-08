import { describe, it, expect } from 'vitest'
import {
    snapMove,
    snapResize,
    overlaps,
    resolveOverlap,
    tidyLayouts,
    compactLayouts,
    alignEdge,
    matchDimension,
    distribute,
    type Placed,
} from './layout'

const rect = (x: number, y: number, w = 100, h = 100) => ({ x, y, w, h })
const placed = (id: string, x: number, y: number, w = 100, h = 100): Placed => ({ id, layout: rect(x, y, w, h) })

describe('snapMove', () => {
    it('snaps a near edge to a candidate within threshold', () => {
        const r = snapMove(103, 50, [100], 7)
        expect(r.pos).toBe(100)
        expect(r.guide).toBe(100)
    })

    it('snaps the far edge (pos + size) to a candidate', () => {
        const r = snapMove(48, 50, [100]) // far edge 98 → 100
        expect(r.pos).toBe(50)
        expect(r.guide).toBe(100)
    })

    it('falls back to the grid when nothing is close', () => {
        const r = snapMove(53, 50, [500], 7)
        expect(r.pos).toBe(56) // snapped to 8px grid
        expect(r.guide).toBeNull()
    })
})

describe('snapResize', () => {
    it('snaps the far edge to a candidate', () => {
        const r = snapResize(20, 78, [100]) // far edge 98 → 100 → size 80
        expect(r.size).toBe(80)
        expect(r.guide).toBe(100)
    })
})

describe('overlaps', () => {
    it('detects and rejects overlap', () => {
        expect(overlaps(rect(0, 0), rect(50, 50))).toBe(true)
        expect(overlaps(rect(0, 0), rect(100, 0))).toBe(false) // edges touch, no overlap
    })
})

describe('resolveOverlap', () => {
    it('pushes a rect below the one it overlaps', () => {
        const r = resolveOverlap(rect(0, 0), [rect(0, 0, 100, 120)], 16)
        expect(r.y).toBe(136) // 0 + 120 + 16
        expect(r.x).toBe(0)
    })

    it('leaves a non-overlapping rect untouched', () => {
        const r = resolveOverlap(rect(300, 0), [rect(0, 0)])
        expect(r).toEqual(rect(300, 0))
    })
})

describe('tidyLayouts', () => {
    it('packs sections into columns within maxWidth', () => {
        const items = [placed('a', 0, 0, 200, 100), placed('b', 0, 0, 200, 100), placed('c', 0, 0, 200, 100)]
        const out = tidyLayouts(items, 500, 16) // two columns (16 + 200 + 16 + 200 = 432 < 500)
        expect(out[0].layout).toMatchObject({ x: 16, y: 16 })
        expect(out[1].layout).toMatchObject({ x: 232, y: 16 })
        expect(out[2].layout).toMatchObject({ x: 16, y: 132 })
    })

    it('masonry: a tall first card sends the next card to the shorter column', () => {
        const items = [placed('a', 0, 0, 200, 300), placed('b', 0, 0, 200, 100), placed('c', 0, 0, 200, 100)]
        const out = tidyLayouts(items, 500, 16) // two columns
        // a fills column 0 (tall); b starts column 1; c goes back to whichever is shorter (column 1).
        expect(out[0].layout).toMatchObject({ x: 16, y: 16 })
        expect(out[1].layout).toMatchObject({ x: 232, y: 16 })
        expect(out[2].layout).toMatchObject({ x: 232, y: 132 })
    })

    it('skyline: a narrow card packs into the space beside a wider card', () => {
        const items = [placed('wide', 0, 0, 300, 100), placed('n1', 0, 0, 150, 100), placed('n2', 0, 0, 150, 100)]
        const out = tidyLayouts(items, 500, 16) // inner width 468
        // wide takes the left; n1 fits in the remaining space to its right on the same row;
        // the top row is then full, so n2 drops to the next row at the left.
        expect(out[0].layout).toMatchObject({ x: 16, y: 16 })
        expect(out[1].layout).toMatchObject({ x: 332, y: 16 })
        expect(out[2].layout).toMatchObject({ x: 16, y: 132 })
    })
})

describe('compactLayouts', () => {
    it('pulls a lower tile up into the gap under the one above it', () => {
        const items = [placed('a', 16, 16, 100, 100), placed('b', 16, 400, 100, 100)]
        const out = compactLayouts(items, 16)
        const byId = Object.fromEntries(out.map((o) => [o.id, o.layout]))
        expect(byId.a).toMatchObject({ x: 16, y: 16 })
        expect(byId.b).toMatchObject({ x: 16, y: 132 }) // a bottom (116) + gap (16)
    })

    it('gravitates a lone far tile to the top-left corner', () => {
        const out = compactLayouts([placed('a', 500, 500, 100, 100)], 16)
        expect(out[0].layout).toMatchObject({ x: 16, y: 16 })
    })

    it('drops a tile into the nearest-to-corner gap (leftmost on ties)', () => {
        // a occupies the top-left; b starts far to the right on the same row. The
        // spot below a and the spot beside a are equidistant from the corner, so
        // the leftmost (below a) wins.
        const items = [placed('a', 16, 16, 100, 100), placed('b', 400, 16, 100, 100)]
        const out = compactLayouts(items, 16)
        const byId = Object.fromEntries(out.map((o) => [o.id, o.layout]))
        expect(byId.a).toMatchObject({ x: 16, y: 16 })
        expect(byId.b).toMatchObject({ x: 16, y: 132 })
    })
})

describe('alignEdge', () => {
    const items = [placed('a', 10, 0, 100, 40), placed('b', 200, 0, 60, 40)]

    it('aligns left edges to the minimum x', () => {
        const out = alignEdge(items, 'left')
        expect(out.map((i) => i.layout.x)).toEqual([10, 10])
    })

    it('aligns right edges', () => {
        const out = alignEdge(items, 'right') // max right = 260
        expect(out.map((i) => i.layout.x + i.layout.w)).toEqual([260, 260])
    })

    it('centers horizontally', () => {
        const out = alignEdge(items, 'hcenter') // bbox center = (10+260)/2 = 135
        expect(out[0].layout.x).toBe(85) // 135 - 50
        expect(out[1].layout.x).toBe(105) // 135 - 30
    })

    it('returns input unchanged with fewer than 2 items', () => {
        expect(alignEdge([items[0]], 'left')).toHaveLength(1)
    })
})

describe('matchDimension', () => {
    it('sets all widths to the first selected', () => {
        const out = matchDimension([placed('a', 0, 0, 100), placed('b', 0, 0, 250)], 'w')
        expect(out.map((i) => i.layout.w)).toEqual([100, 100])
    })
})

describe('distribute', () => {
    it('evenly spaces 3+ boxes horizontally', () => {
        const items = [placed('a', 0, 0, 100, 40), placed('b', 120, 0, 100, 40), placed('c', 500, 0, 100, 40)]
        const out = distribute(items, 'h')
        // extent 0..600, total width 300, 2 gaps → gap 150; positions 0, 250, 500
        expect(out.map((i) => i.layout.x)).toEqual([0, 250, 500])
    })

    it('needs at least 3 boxes', () => {
        expect(distribute([placed('a', 0, 0), placed('b', 200, 0)], 'h')).toHaveLength(2)
    })
})
