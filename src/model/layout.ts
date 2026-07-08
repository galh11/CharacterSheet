import type { SectionLayout } from './characterSheet'

/** A section identified by id together with its rectangle. */
export interface Placed {
    id: string
    layout: SectionLayout
}

export const GRID = 8
export const SNAP = 7
export const GAP = 16

export const snapGrid = (v: number): number => Math.round(v / GRID) * GRID

/** Snap a moving box's near/center/far edge on one axis to candidate lines. */
export function snapMove(
    pos: number,
    size: number,
    candidates: number[],
    threshold = SNAP,
): { pos: number; guide: number | null } {
    const anchors = [pos, pos + size / 2, pos + size]
    let best = { delta: Infinity, guide: null as number | null }
    for (const anchor of anchors) {
        for (const c of candidates) {
            const d = c - anchor
            if (Math.abs(d) < Math.abs(best.delta)) best = { delta: d, guide: c }
        }
    }
    if (Math.abs(best.delta) <= threshold) return { pos: pos + best.delta, guide: best.guide }
    return { pos: snapGrid(pos), guide: null }
}

/** Snap a resizing box's far edge to candidate lines. */
export function snapResize(
    pos: number,
    size: number,
    candidates: number[],
    threshold = SNAP,
): { size: number; guide: number | null } {
    const far = pos + size
    let best = { delta: Infinity, guide: null as number | null }
    for (const c of candidates) {
        const d = c - far
        if (Math.abs(d) < Math.abs(best.delta)) best = { delta: d, guide: c }
    }
    if (Math.abs(best.delta) <= threshold) return { size: size + best.delta, guide: best.guide }
    return { size: snapGrid(size), guide: null }
}

export const overlaps = (a: SectionLayout, b: SectionLayout): boolean =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

/** Push a rect straight down until it no longer overlaps any sibling. */
export const resolveOverlap = (
    rect: SectionLayout,
    others: SectionLayout[],
    gap = GAP,
): SectionLayout => {
    let r = rect
    for (let i = 0; i < 40; i++) {
        const hit = others.find((o) => overlaps(r, o))
        if (!hit) break
        r = { ...r, y: hit.y + hit.h + gap }
    }
    return r
}

/** Tightly top-left "skyline" bin-pack: each card is dropped into the highest
 *  (smallest y) then leftmost position where it fits within maxWidth, resting on
 *  the contour of the cards already placed. Tiles of differing widths and heights
 *  end up flush against each other in both rows and columns — like a stack
 *  view, but preserving each card's own size. Order is preserved as a tiebreak. */
export const tidyLayouts = (items: Placed[], maxWidth: number, gap = GAP): Placed[] => {
    if (items.length === 0) return items
    const left = gap
    const innerWidth = Math.max(1, maxWidth - 2 * gap)
    const right = left + innerWidth
    // The skyline is the top contour, stored as sorted segments over [left, right).
    let sky: { x: number; width: number; y: number }[] = [{ x: left, width: innerWidth, y: gap }]

    const maxYOver = (x0: number, x1: number): number => {
        let y = 0
        for (const s of sky) {
            if (s.x + s.width <= x0 || s.x >= x1) continue
            if (s.y > y) y = s.y
        }
        return y
    }
    const raise = (x0: number, x1: number, newY: number) => {
        const next: typeof sky = []
        for (const s of sky) {
            const end = s.x + s.width
            if (end <= x0 || s.x >= x1) {
                next.push(s)
                continue
            }
            if (s.x < x0) next.push({ x: s.x, width: x0 - s.x, y: s.y })
            if (end > x1) next.push({ x: x1, width: end - x1, y: s.y })
        }
        next.push({ x: x0, width: x1 - x0, y: newY })
        next.sort((a, b) => a.x - b.x)
        // Merge neighbouring segments that ended up at the same height.
        const merged: typeof sky = []
        for (const s of next) {
            const last = merged[merged.length - 1]
            if (last && last.y === s.y && Math.abs(last.x + last.width - s.x) < 0.001) last.width += s.width
            else merged.push({ ...s })
        }
        sky = merged
    }

    return items.map(({ id, layout }) => {
        const bw = layout.w
        const bh = layout.h
        const candidates = new Set<number>([left, ...sky.map((s) => s.x)])
        let bestX = left
        let bestY = Infinity
        for (const x of candidates) {
            // Skip positions that would overflow the container (except the left fallback).
            if (x > left && x + bw > right + 0.001) continue
            const y = maxYOver(x, Math.min(x + bw, right))
            if (y < bestY || (y === bestY && x < bestX)) {
                bestY = y
                bestX = x
            }
        }
        if (!isFinite(bestY)) {
            bestX = left
            bestY = maxYOver(left, right)
        }
        raise(bestX, Math.min(bestX + bw + gap, right), bestY + bh + gap)
        return { id, layout: { ...layout, x: bestX, y: bestY } }
    })
}

/** Compact tiles toward the top-left corner. Tiles are processed in order of
 *  their distance (L2 norm) to the top-left corner — closest first — and each is
 *  pushed as far up, then left, as it can go without overlapping tiles already
 *  settled. This squeezes out empty space while keeping the tile nearest the
 *  corner nearest the corner. Sizes are untouched (fit them first if you want). */
export const compactLayouts = (items: Placed[], gap = GAP): Placed[] => {
    if (items.length === 0) return items
    const order = [...items].sort(
        (a, b) => a.layout.x ** 2 + a.layout.y ** 2 - (b.layout.x ** 2 + b.layout.y ** 2),
    )
    const settled: SectionLayout[] = []
    const out: Placed[] = []
    for (const { id, layout } of order) {
        const { w, h } = layout
        let x = layout.x
        let y = layout.y
        // Alternate "slide up" and "slide left" until neither moves — this lets a
        // tile that unblocked by moving left then rise further, and vice versa.
        for (let i = 0; i < 8; i++) {
            let top = gap
            for (const o of settled) if (x < o.x + o.w && x + w > o.x) top = Math.max(top, o.y + o.h + gap)
            let left = gap
            for (const o of settled) if (top < o.y + o.h && top + h > o.y) left = Math.max(left, o.x + o.w + gap)
            if (top === y && left === x) break
            y = top
            x = left
        }
        settled.push({ x, y, w, h })
        out.push({ id, layout: { ...layout, x, y } })
    }
    return out
}

const boundingBox = (rects: SectionLayout[]) => ({
    minX: Math.min(...rects.map((r) => r.x)),
    minY: Math.min(...rects.map((r) => r.y)),
    maxX: Math.max(...rects.map((r) => r.x + r.w)),
    maxY: Math.max(...rects.map((r) => r.y + r.h)),
})

export type AlignEdge = 'left' | 'hcenter' | 'right' | 'top' | 'vmiddle' | 'bottom'

/** Align 2+ boxes to a shared edge/center of their bounding box. */
export const alignEdge = (items: Placed[], edge: AlignEdge): Placed[] => {
    if (items.length < 2) return items
    const { minX, minY, maxX, maxY } = boundingBox(items.map((i) => i.layout))
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    return items.map(({ id, layout: l }) => {
        const patch: Partial<SectionLayout> =
            edge === 'left' ? { x: minX }
                : edge === 'right' ? { x: maxX - l.w }
                    : edge === 'hcenter' ? { x: Math.round(cx - l.w / 2) }
                        : edge === 'top' ? { y: minY }
                            : edge === 'bottom' ? { y: maxY - l.h }
                                : { y: Math.round(cy - l.h / 2) }
        return { id, layout: { ...l, ...patch } }
    })
}

/** Set every selected box's width or height to the first one's. */
export const matchDimension = (items: Placed[], dim: 'w' | 'h'): Placed[] => {
    if (items.length < 2) return items
    const val = items[0].layout[dim]
    return items.map(({ id, layout }) => ({ id, layout: { ...layout, [dim]: val } }))
}

/** Evenly space 3+ boxes horizontally or vertically across their extent. */
export const distribute = (items: Placed[], axis: 'h' | 'v'): Placed[] => {
    if (items.length < 3) return items
    const key = axis === 'h' ? 'x' : 'y'
    const size = axis === 'h' ? 'w' : 'h'
    const sorted = [...items].sort((a, b) => a.layout[key] - b.layout[key])
    const first = sorted[0].layout[key]
    const last = sorted[sorted.length - 1].layout
    const lastEnd = last[key] + last[size]
    const totalSize = sorted.reduce((n, s) => n + s.layout[size], 0)
    const gap = (lastEnd - first - totalSize) / (sorted.length - 1)
    let cursor = first
    return sorted.map(({ id, layout }) => {
        const out = { id, layout: { ...layout, [key]: Math.round(cursor) } }
        cursor += layout[size] + gap
        return out
    })
}
