import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import type { D20Mode, RollLogEntry } from '../model/dice'

interface RollLogProps {
    entries: RollLogEntry[]
    rollMode: D20Mode
    onRollModeChange: (mode: D20Mode) => void
    bonus: number
    onBonusChange: (bonus: number) => void
    bonusDie: number
    onBonusDieChange: (sides: number) => void
    repeat: number
    onRepeatChange: (n: number) => void
    luck?: number
    onSpendLuck: () => void
    onRollDice: (expr: string) => void
    onClear: () => void
    /** Render inline inside the sidebar (no fixed positioning / drag / resize). */
    docked?: boolean
}

const MODES: { value: D20Mode; label: string }[] = [
    { value: 'advantage', label: 'ADV' },
    { value: 'normal', label: 'Normal' },
    { value: 'disadvantage', label: 'DIS' },
]

/** Per-kind colour scheme: the title text colour, the left accent bar, and the
 *  total badge tint, so each roll type is scannable at a glance. */
const kindStyle: Record<RollLogEntry['kind'], { text: string; accent: string; badge: string }> = {
    attack: { text: 'text-cyan-300', accent: 'bg-cyan-500', badge: 'bg-cyan-500/15 text-cyan-200' },
    damage: { text: 'text-rose-300', accent: 'bg-rose-500', badge: 'bg-rose-500/15 text-rose-200' },
    check: { text: 'text-slate-200', accent: 'bg-slate-500', badge: 'bg-slate-800 text-slate-100' },
    save: { text: 'text-violet-300', accent: 'bg-violet-500', badge: 'bg-violet-500/15 text-violet-200' },
    heal: { text: 'text-emerald-300', accent: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-200' },
    raw: { text: 'text-slate-200', accent: 'bg-slate-500', badge: 'bg-slate-800 text-slate-100' },
}

const SIZE_KEY = 'character-sheet:rolllog-size'
const POS_KEY = 'character-sheet:rolllog-pos'
const MIN_W = 240
const MAX_W = 640
const MIN_H = 60
const MAX_H = 640
const DEFAULT_SIZE = { w: 288, h: 180 }

const loadSize = (): { w: number; h: number } => {
    try {
        const raw = localStorage.getItem(SIZE_KEY)
        if (raw) {
            const parsed = JSON.parse(raw) as { w?: number; h?: number }
            return {
                w: Math.min(MAX_W, Math.max(MIN_W, parsed.w ?? DEFAULT_SIZE.w)),
                h: Math.min(MAX_H, Math.max(MIN_H, parsed.h ?? DEFAULT_SIZE.h)),
            }
        }
    } catch {
        /* ignore */
    }
    return DEFAULT_SIZE
}

/** Saved top-left position (in viewport pixels), or null to keep the default
 *  bottom-right anchor. */
const loadPos = (): { x: number; y: number } | null => {
    try {
        const raw = localStorage.getItem(POS_KEY)
        if (raw) {
            const p = JSON.parse(raw) as { x?: number; y?: number }
            if (typeof p.x === 'number' && typeof p.y === 'number') return { x: p.x, y: p.y }
        }
    } catch {
        /* ignore */
    }
    return null
}

/** Keep a top-left position fully within the viewport for a panel of size w×h. */
const clampPos = (x: number, y: number, w: number, h: number) => ({
    x: Math.min(Math.max(0, x), Math.max(0, window.innerWidth - w)),
    y: Math.min(Math.max(0, y), Math.max(0, window.innerHeight - h)),
})

/** A single roll row: a kind-coloured accent bar, the title (with a crit/miss
 *  pill), the dice breakdown, and the total badge. `flash` briefly rings the row
 *  when a fresh roll lands. */
function RollRow({ e, flash }: { e: RollLogEntry; flash?: boolean }) {
    const s = kindStyle[e.kind]
    return (
        <li
            className={clsx(
                'relative flex items-start gap-2 overflow-hidden rounded-md border border-slate-800/70 bg-slate-900/40 py-1.5 pl-3 pr-2',
                flash && 'animate-roll-flash motion-reduce:animate-none',
            )}
        >
            <span className={clsx('absolute inset-y-0 left-0 w-1', s.accent)} aria-hidden="true" />
            <div className="min-w-0 flex-1">
                <div className={clsx('flex items-center gap-1 text-xs font-medium', s.text)}>
                    <span className="truncate">{e.title}</span>
                    {e.crit === 'hit' && (
                        <span className="shrink-0 rounded bg-emerald-500/20 px-1 text-[10px] font-bold text-emerald-300">CRIT</span>
                    )}
                    {e.crit === 'miss' && (
                        <span className="shrink-0 rounded bg-rose-500/20 px-1 text-[10px] font-bold text-rose-300">MISS</span>
                    )}
                </div>
                <div className="truncate font-mono text-[11px] text-slate-400">{e.detail}</div>
            </div>
            <span className={clsx('mt-0.5 shrink-0 rounded-md px-2 py-0.5 font-mono text-sm font-bold tabular-nums', s.badge)}>
                {e.total}
            </span>
        </li>
    )
}

/** Floating panel showing recent dice rolls plus the advantage/disadvantage toggle.
 *  Shows only the latest roll (with a flash on each fresh result) until the history
 *  is expanded; when collapsed it still shows a compact latest-roll summary. Drag
 *  the header to move it anywhere (double-click the header to reset), resize from the
 *  bottom-right grip, and the roll list scrolls within a viewport-capped card so a
 *  long history never spills off-screen. Position and size are persisted. */
export function RollLog({ entries, rollMode, onRollModeChange, bonus, onBonusChange, bonusDie, onBonusDieChange, repeat, onRepeatChange, luck, onSpendLuck, onRollDice, onClear, docked }: RollLogProps) {
    // Docked in the rail it starts collapsed (just the latest-roll bar) so it
    // doesn't crowd the core stats above it; floating it opens by default.
    const [open, setOpen] = useState(!docked)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [dice, setDice] = useState('')
    const [size, setSize] = useState(loadSize)
    const [pos, setPos] = useState<{ x: number; y: number } | null>(loadPos)
    const rootRef = useRef<HTMLDivElement | null>(null)
    const drag = useRef<{ x: number; y: number; w: number; h: number } | null>(null)
    const move = useRef<{ px: number; py: number; x: number; y: number; w: number; h: number } | null>(null)

    useEffect(() => {
        try {
            localStorage.setItem(SIZE_KEY, JSON.stringify(size))
        } catch {
            /* ignore quota */
        }
    }, [size])

    useEffect(() => {
        try {
            if (pos) localStorage.setItem(POS_KEY, JSON.stringify(pos))
            else localStorage.removeItem(POS_KEY)
        } catch {
            /* ignore quota */
        }
    }, [pos])

    // Keep a moved panel on-screen when the window is resized smaller.
    useEffect(() => {
        if (!pos) return
        const onResize = () => {
            const rect = rootRef.current?.getBoundingClientRect()
            if (!rect) return
            setPos((p) => (p ? clampPos(p.x, p.y, rect.width, rect.height) : p))
        }
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [pos])

    // Resize from the bottom-right corner: dragging down/right grows the panel
    // width and the roll-list height (both persisted).
    const onResizePointerDown = (event: React.PointerEvent) => {
        event.preventDefault()
        drag.current = { x: event.clientX, y: event.clientY, w: size.w, h: size.h }
        event.currentTarget.setPointerCapture(event.pointerId)
    }
    const onResizePointerMove = (event: React.PointerEvent) => {
        if (!drag.current) return
        const dx = event.clientX - drag.current.x
        const dy = event.clientY - drag.current.y
        setSize({
            w: Math.min(MAX_W, Math.max(MIN_W, drag.current.w + dx)),
            h: Math.min(MAX_H, Math.max(MIN_H, drag.current.h + dy)),
        })
    }
    const onResizePointerUp = (event: React.PointerEvent) => {
        drag.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
    }

    // Drag the header to move the whole panel. Ignore drags that start on an
    // interactive control so the buttons still work.
    const onMovePointerDown = (event: React.PointerEvent) => {
        if ((event.target as HTMLElement).closest('button, input, [role="radiogroup"]')) return
        const rect = rootRef.current?.getBoundingClientRect()
        if (!rect) return
        event.preventDefault()
        move.current = { px: event.clientX, py: event.clientY, x: rect.left, y: rect.top, w: rect.width, h: rect.height }
        event.currentTarget.setPointerCapture(event.pointerId)
    }
    const onMovePointerMove = (event: React.PointerEvent) => {
        if (!move.current) return
        const dx = event.clientX - move.current.px
        const dy = event.clientY - move.current.py
        setPos(clampPos(move.current.x + dx, move.current.y + dy, move.current.w, move.current.h))
    }
    const onMovePointerUp = (event: React.PointerEvent) => {
        if (!move.current) return
        move.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const latest = entries[0]
    const rest = entries.slice(1)

    return (
        <div
            ref={rootRef}
            className={clsx('print:hidden', docked ? 'w-full' : 'fixed z-40', !docked && !pos && 'bottom-4 right-4 md:right-[calc(var(--sidebar-w)_+_1rem)]')}
            style={docked ? undefined : pos ? { left: pos.x, top: pos.y, width: size.w } : { width: size.w }}
        >
            <div className={clsx('relative flex flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-950/95 shadow-xl backdrop-blur', docked ? 'max-h-[55vh]' : 'max-h-[calc(100vh-1rem)]')}>
            <div
                onPointerDown={docked ? undefined : onMovePointerDown}
                onPointerMove={docked ? undefined : onMovePointerMove}
                onPointerUp={docked ? undefined : onMovePointerUp}
                onDoubleClick={docked ? undefined : () => setPos(null)}
                className={clsx('flex shrink-0 select-none items-center gap-2 border-b border-slate-800 px-3 py-2', !docked && 'cursor-move touch-none')}
                title={docked ? undefined : 'Drag to move · double-click to reset position'}
            >
                <span className="text-sm font-semibold text-slate-200">🎲 Rolls</span>
                {open ? (
                    <>
                        <div className="ml-auto flex overflow-hidden rounded-md border border-slate-700" role="radiogroup" aria-label="Roll mode">
                            {MODES.map((m) => (
                                <button
                                    key={m.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={rollMode === m.value}
                                    onClick={() => onRollModeChange(m.value)}
                                    className={clsx(
                                        'px-1.5 py-0.5 text-[10px] font-semibold transition-colors',
                                        rollMode === m.value
                                            ? m.value === 'advantage'
                                                ? 'bg-emerald-600 text-white'
                                                : m.value === 'disadvantage'
                                                    ? 'bg-rose-600 text-white'
                                                    : 'bg-slate-600 text-white'
                                            : 'text-slate-400 hover:bg-slate-800',
                                    )}
                                    title={`Roll with ${m.value}`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={onClear}
                            disabled={entries.length === 0}
                            className={clsx(
                                'rounded px-1.5 py-0.5 text-[11px]',
                                entries.length === 0 ? 'cursor-not-allowed text-slate-600' : 'text-slate-400 hover:bg-slate-800 hover:text-rose-300',
                            )}
                            title="Clear the roll log"
                            aria-label="Clear roll log"
                        >
                            Clear
                        </button>
                    </>
                ) : (
                    latest && (
                        <span className="ml-auto flex min-w-0 items-center gap-1.5" title={`${latest.title} — ${latest.detail}`}>
                            <span className={clsx('truncate text-xs font-medium', kindStyle[latest.kind].text)}>{latest.title}</span>
                            <span className={clsx('shrink-0 rounded px-1.5 py-0.5 font-mono text-xs font-bold tabular-nums', kindStyle[latest.kind].badge)}>
                                {latest.total}
                            </span>
                        </span>
                    )
                )}
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    className={clsx('rounded px-1 text-slate-400 hover:bg-slate-800', !open && !latest && 'ml-auto')}
                    aria-label={open ? 'Collapse roll log' : 'Expand roll log'}
                >
                    {open ? '▾' : '▸'}
                </button>
            </div>
            {open && (
                <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex shrink-0 items-center gap-2 border-b border-slate-800 px-3 py-1.5 text-xs">
                        <label className="flex items-center gap-1 text-slate-400">
                            Situational
                            <input
                                type="number"
                                value={bonus === 0 ? '' : bonus}
                                onChange={(e) => onBonusChange(Number(e.target.value) || 0)}
                                placeholder="+0"
                                aria-label="Situational modifier"
                                className="w-12 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-center font-mono text-slate-100"
                            />
                        </label>
                        {bonus !== 0 && (
                            <button type="button" onClick={() => onBonusChange(0)} className="rounded border border-slate-700 px-1 text-slate-400 hover:bg-slate-800">
                                clear
                            </button>
                        )}
                        {luck != null && (
                            <button
                                type="button"
                                onClick={onSpendLuck}
                                disabled={luck <= 0}
                                className={clsx(
                                    'ml-auto rounded px-2 py-0.5 text-[11px] font-medium',
                                    luck > 0 ? 'bg-amber-500/80 text-slate-950 hover:bg-amber-400' : 'cursor-not-allowed bg-slate-800 text-slate-600',
                                )}
                                title="Spend a Luck Point (Advantage on a d20)"
                            >
                                🍀 Luck ({luck})
                            </button>
                        )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-slate-800 px-3 py-1.5 text-[11px]">
                        <button type="button" onClick={() => onBonusChange(bonus - 2)} className="rounded border border-slate-700 px-1.5 py-0.5 text-slate-300 hover:bg-slate-800" title="Half cover">Cover −2</button>
                        <button type="button" onClick={() => onBonusChange(bonus - 5)} className="rounded border border-slate-700 px-1.5 py-0.5 text-slate-300 hover:bg-slate-800" title="Three-quarters cover">Heavy −5</button>
                        <button
                            type="button"
                            onClick={() => onBonusDieChange(bonusDie === 4 ? 0 : 4)}
                            className={clsx('rounded px-1.5 py-0.5', bonusDie === 4 ? 'bg-emerald-600 text-white' : 'border border-slate-700 text-slate-300 hover:bg-slate-800')}
                            title="Add a fresh 1d4 to each d20 (Bless / Guidance)"
                        >
                            +1d4
                        </button>
                        <label className="ml-auto flex items-center gap-1 text-slate-400" title="Roll each d20 check this many times">
                            ×
                            <input
                                type="number"
                                min={1}
                                value={repeat}
                                onChange={(e) => onRepeatChange(Math.max(1, Number(e.target.value) || 1))}
                                aria-label="Repeat rolls"
                                className="w-10 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-center font-mono text-slate-100"
                            />
                        </label>
                    </div>
                    <form
                        className="flex shrink-0 items-center gap-1 border-b border-slate-800 px-3 py-1.5"
                        onSubmit={(e) => {
                            e.preventDefault()
                            onRollDice(dice)
                            setDice('')
                        }}
                    >
                        <input
                            value={dice}
                            onChange={(e) => setDice(e.target.value)}
                            placeholder="free dice e.g. 2d6+3"
                            aria-label="Free dice expression"
                            className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-slate-100"
                        />
                        <button type="submit" className="rounded bg-slate-700 px-2 py-0.5 text-[11px] font-medium text-slate-100 hover:bg-slate-600">Roll</button>
                    </form>
                    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2" style={{ maxHeight: size.h }}>
                        {!latest ? (
                            <div className="flex flex-col items-center gap-1 py-3 text-center">
                                <span className="text-2xl opacity-40" aria-hidden="true">🎲</span>
                                <p className="m-0 text-xs italic text-slate-500">Click an attack, skill, save or hit die to roll.</p>
                            </div>
                        ) : (
                            <>
                                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                                    <RollRow key={latest.id} e={latest} flash />
                                </ul>
                                {rest.length > 0 && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setHistoryOpen((h) => !h)}
                                            className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-slate-800 py-1 text-[11px] text-slate-400 hover:bg-slate-800"
                                            aria-expanded={historyOpen}
                                        >
                                            {historyOpen ? '▾ Hide history' : `▸ History (${rest.length})`}
                                        </button>
                                        {historyOpen && (
                                            <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
                                                {rest.map((e) => (
                                                    <RollRow key={e.id} e={e} />
                                                ))}
                                            </ul>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
            </div>
            {open && !docked && (
                <div
                    onPointerDown={onResizePointerDown}
                    onPointerMove={onResizePointerMove}
                    onPointerUp={onResizePointerUp}
                    className="absolute -bottom-1 -right-1 z-10 grid h-5 w-5 cursor-nwse-resize place-items-center rounded-full border border-slate-600 bg-slate-800 text-[11px] leading-none text-slate-400 hover:bg-slate-700"
                    title="Drag to resize"
                    aria-label="Resize roll log"
                >
                    <span className="pointer-events-none">⤡</span>
                </div>
            )}
        </div>
    )
}
