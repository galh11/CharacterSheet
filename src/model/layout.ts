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

/** Column-aware compaction that preserves a hand-built arrangement. Cards are
 *  grouped into columns by horizontal overlap in their current positions (cards
 *  stacked over one another share a column), each column is stacked top-to-bottom
 *  with vertical gaps removed, and the columns are packed left-to-right with
 *  horizontal gaps removed. So a manually laid-out masonry just tightens up — its
 *  columns and their order are kept — instead of reflowing every card into the
 *  top-left corner. Sizes are untouched (fit them first if you want). */
export const compactLayouts = (items: Placed[], gap = GAP): Placed[] => {
    if (items.length === 0) return items
    interface Column {
        minX: number
        maxX: number
        items: Placed[]
    }
    // Process left-to-right (then top-to-bottom) so columns form in reading order.
    const sorted = [...items].sort(
        (a, b) => a.layout.x - b.layout.x || a.layout.y - b.layout.y,
    )
    const columns: Column[] = []
    for (const p of sorted) {
        const x0 = p.layout.x
        const x1 = p.layout.x + p.layout.w
        // Join the existing column this card overlaps most — but only if at least
        // half of the card sits over it, so a wider card starts its own column
        // rather than merging two neighbouring ones.
        let best: Column | null = null
        let bestOverlap = 0
        for (const c of columns) {
            const overlap = Math.min(x1, c.maxX) - Math.max(x0, c.minX)
            if (overlap > bestOverlap) {
                bestOverlap = overlap
                best = c
            }
        }
        if (best && bestOverlap >= (x1 - x0) * 0.5) {
            best.items.push(p)
            best.minX = Math.min(best.minX, x0)
            best.maxX = Math.max(best.maxX, x1)
        } else {
            columns.push({ minX: x0, maxX: x1, items: [p] })
        }
    }
    // Pack columns left-to-right (by their leftmost edge), cards top-to-bottom.
    columns.sort((a, b) => a.minX - b.minX)
    const out: Placed[] = []
    let colX = gap
    for (const c of columns) {
        const width = Math.max(...c.items.map((p) => p.layout.w))
        let y = gap
        for (const p of [...c.items].sort((a, b) => a.layout.y - b.layout.y)) {
            out.push({ id: p.id, layout: { ...p.layout, x: colX, y } })
            y += p.layout.h + gap
        }
        colX += width + gap
    }
    return out
}

// ── Dashboard grid ──────────────────────────────────────────────────────────
// Cards live on a fixed column grid (like Grafana / Notion / react-grid-layout):
// a card is a whole number of columns wide and a whole number of small rows tall,
// so the layout is tidy by construction — snap to columns, then compact upward to
// fill vertical gaps. This removes the guessing that a free absolute canvas forces
// onto "Tidy". Pixel layouts stay the source of truth; the grid is a snap +
// compaction layer whose geometry is derived from these metrics.

/** Geometry of the column grid. Margin is the gap between cells on both axes; a
 *  card spanning several cells absorbs the internal margins into its own size. */
export interface GridMetrics {
    /** Number of columns. */
    cols: number
    /** Width of one column, in px. */
    colWidth: number
    /** Height of one row, in px (kept small so card heights aren't clipped). */
    rowHeight: number
    /** Gap between cells, in px (both axes). */
    margin: number
    /** Left / top padding before the first cell, in px. */
    pad: number
}

export const DEFAULT_GRID_COLS = 12

/** Build grid metrics for a column count (sensible defaults for card-sized tiles). */
export const gridMetrics = (cols = DEFAULT_GRID_COLS): GridMetrics => ({
    cols,
    colWidth: 88,
    rowHeight: 8,
    margin: GAP,
    pad: GAP,
})

/** A card's rectangle in whole grid cells. */
export interface GridCell {
    cx: number
    cy: number
    cw: number
    ch: number
}

const colStep = (m: GridMetrics) => m.colWidth + m.margin
const rowStep = (m: GridMetrics) => m.rowHeight + m.margin
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Total logical width of the grid in px (used to size the canvas). */
export const gridWidth = (m: GridMetrics): number =>
    m.pad * 2 + m.cols * m.colWidth + (m.cols - 1) * m.margin

/** Snap a pixel rect to the nearest grid cell (columns rounded, height ceiled so a
 *  card never loses content). Column span is clamped to fit within the grid. */
export const toCell = (l: SectionLayout, m: GridMetrics): GridCell => {
    const cw = clamp(Math.round((l.w + m.margin) / colStep(m)), 1, m.cols)
    const cx = clamp(Math.round((l.x - m.pad) / colStep(m)), 0, m.cols - cw)
    const cy = Math.max(0, Math.round((l.y - m.pad) / rowStep(m)))
    const ch = Math.max(1, Math.ceil((l.h + m.margin) / rowStep(m)))
    return { cx, cy, cw, ch }
}

/** Convert a grid cell back to a pixel rect. */
export const fromCell = (c: GridCell, m: GridMetrics): SectionLayout => ({
    x: m.pad + c.cx * colStep(m),
    y: m.pad + c.cy * rowStep(m),
    w: c.cw * m.colWidth + (c.cw - 1) * m.margin,
    h: c.ch * m.rowHeight + (c.ch - 1) * m.margin,
})

/** Snap a single pixel rect onto the grid (idempotent). */
export const snapToGrid = (l: SectionLayout, m: GridMetrics): SectionLayout =>
    fromCell(toCell(l, m), m)

const cellsCollide = (a: GridCell, b: GridCell): boolean =>
    a.cx < b.cx + b.cw && a.cx + a.cw > b.cx && a.cy < b.cy + b.ch && a.cy + a.ch > b.cy

/** Snap every card to the grid, then compact upward: each card keeps its column
 *  (cx) and drops to the highest row with no collision, filling vertical gaps
 *  without reflowing across columns. Cards are processed top-to-bottom then
 *  left-to-right so columns fill from the top. Idempotent. */
export const compactGrid = (items: Placed[], m: GridMetrics): Placed[] => {
    if (items.length === 0) return items
    const cells = items.map((p) => ({ id: p.id, cell: toCell(p.layout, m), layout: p.layout }))
    cells.sort((a, b) => a.cell.cy - b.cell.cy || a.cell.cx - b.cell.cx)
    const placed: GridCell[] = []
    const out: Placed[] = []
    for (const { id, cell, layout } of cells) {
        let cy = 0
        while (placed.some((p) => cellsCollide({ ...cell, cy }, p))) cy++
        const settled: GridCell = { ...cell, cy }
        placed.push(settled)
        out.push({ id, layout: { ...layout, ...fromCell(settled, m) } })
    }
    return out
}

/** Reflow the grid around a card being dragged: the moving card is pinned at
 *  `target` (its live cursor cell) and every other card is compacted upward
 *  around it (kept in its own column, dropped to the highest free row). Used for
 *  the live drag preview and the drop commit so the layout you see while dragging
 *  is exactly what lands — neighbours slide out of the way, the dragged card stays
 *  where you release it. Overlap-free. */
export const placeInGrid = (
    items: Placed[],
    movingId: string,
    target: GridCell,
    m: GridMetrics,
): Placed[] => {
    if (items.length === 0) return items
    const moving = items.find((p) => p.id === movingId)
    const pinned: GridCell = {
        cx: clamp(target.cx, 0, Math.max(0, m.cols - target.cw)),
        cy: Math.max(0, target.cy),
        cw: clamp(target.cw, 1, m.cols),
        ch: Math.max(1, target.ch),
    }
    const placed: GridCell[] = [pinned]
    const out: Placed[] = moving
        ? [{ id: movingId, layout: { ...moving.layout, ...fromCell(pinned, m) } }]
        : []
    const others = items
        .filter((p) => p.id !== movingId)
        .map((p) => ({ id: p.id, cell: toCell(p.layout, m), layout: p.layout }))
        .sort((a, b) => a.cell.cy - b.cell.cy || a.cell.cx - b.cell.cx)
    for (const { id, cell, layout } of others) {
        let cy = 0
        while (placed.some((p) => cellsCollide({ ...cell, cy }, p))) cy++
        const settled: GridCell = { ...cell, cy }
        placed.push(settled)
        out.push({ id, layout: { ...layout, ...fromCell(settled, m) } })
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
