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

/** Shelf-pack sections into rows that fit within maxWidth. */
export const tidyLayouts = (items: Placed[], maxWidth: number, gap = GAP): Placed[] => {
    let x = gap
    let y = gap
    let rowH = 0
    return items.map(({ id, layout }) => {
        if (x > gap && x + layout.w + gap > maxWidth) {
            x = gap
            y += rowH + gap
            rowH = 0
        }
        const next = { id, layout: { ...layout, x, y } }
        x += layout.w + gap
        rowH = Math.max(rowH, layout.h)
        return next
    })
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
