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
}

const MODES: { value: D20Mode; label: string }[] = [
    { value: 'advantage', label: 'ADV' },
    { value: 'normal', label: 'Normal' },
    { value: 'disadvantage', label: 'DIS' },
]

const kindColor: Record<RollLogEntry['kind'], string> = {
    attack: 'text-cyan-300',
    damage: 'text-rose-300',
    check: 'text-slate-200',
    save: 'text-violet-300',
    heal: 'text-emerald-300',
    raw: 'text-slate-200',
}

const SIZE_KEY = 'character-sheet:rolllog-size'
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

/** A single roll row. */
function RollRow({ e }: { e: RollLogEntry }) {
    return (
        <li className="flex items-start gap-2 border-b border-slate-800/60 pb-1.5 last:border-0">
            <div className="min-w-0 flex-1">
                <div className={clsx('truncate text-xs font-medium', kindColor[e.kind])}>
                    {e.title}
                    {e.crit === 'hit' && <span className="ml-1 text-emerald-400">CRIT!</span>}
                    {e.crit === 'miss' && <span className="ml-1 text-rose-400">MISS!</span>}
                </div>
                <div className="truncate font-mono text-[11px] text-slate-400">{e.detail}</div>
            </div>
            <span className="mt-0.5 shrink-0 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-sm font-bold text-slate-100">
                {e.total}
            </span>
        </li>
    )
}

/** Floating panel showing recent dice rolls plus the advantage/disadvantage toggle.
 *  Shows only the latest roll until the history is expanded, keeps Clear always
 *  visible, and can be resized (width + history height, persisted). */
export function RollLog({ entries, rollMode, onRollModeChange, bonus, onBonusChange, bonusDie, onBonusDieChange, repeat, onRepeatChange, luck, onSpendLuck, onRollDice, onClear }: RollLogProps) {
    const [open, setOpen] = useState(true)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [dice, setDice] = useState('')
    const [size, setSize] = useState(loadSize)
    const drag = useRef<{ x: number; y: number; w: number; h: number } | null>(null)

    useEffect(() => {
        try {
            localStorage.setItem(SIZE_KEY, JSON.stringify(size))
        } catch {
            /* ignore quota */
        }
    }, [size])

    // Resize from the top-left corner (the panel is anchored bottom-right, so
    // dragging up/left grows it). Width and history height both adjust.
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
            w: Math.min(MAX_W, Math.max(MIN_W, drag.current.w - dx)),
            h: Math.min(MAX_H, Math.max(MIN_H, drag.current.h - dy)),
        })
    }
    const onResizePointerUp = (event: React.PointerEvent) => {
        drag.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const latest = entries[0]
    const rest = entries.slice(1)

    return (
        <div
            className="fixed bottom-4 right-4 z-40 rounded-xl border border-slate-700 bg-slate-950/95 shadow-xl backdrop-blur print:hidden"
            style={{ width: size.w }}
        >
            {open && (
                <div
                    onPointerDown={onResizePointerDown}
                    onPointerMove={onResizePointerMove}
                    onPointerUp={onResizePointerUp}
                    className="absolute -left-1 -top-1 z-10 grid h-4 w-4 cursor-nwse-resize place-items-center rounded-full border border-slate-600 bg-slate-800 text-[10px] leading-none text-slate-400 hover:bg-slate-700"
                    title="Drag to resize"
                    aria-label="Resize roll log"
                >
                    <span className="pointer-events-none">⤡</span>
                </div>
            )}
            <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
                <span className="text-sm font-semibold text-slate-200">🎲 Rolls</span>
                <div className="ml-auto flex overflow-hidden rounded-md border border-slate-700">
                    {MODES.map((m) => (
                        <button
                            key={m.value}
                            type="button"
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
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    className="rounded px-1 text-slate-400 hover:bg-slate-800"
                    aria-label={open ? 'Collapse roll log' : 'Expand roll log'}
                >
                    {open ? '▾' : '▸'}
                </button>
            </div>
            {open && (
                <>
                    <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-1.5 text-xs">
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
                    <div className="flex flex-wrap items-center gap-1 border-b border-slate-800 px-3 py-1.5 text-[11px]">
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
                        className="flex items-center gap-1 border-b border-slate-800 px-3 py-1.5"
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
                    <div className="px-3 py-2">
                        {!latest ? (
                            <p className="m-0 text-xs italic text-slate-500">Click an attack, skill, save or hit die to roll.</p>
                        ) : (
                            <>
                                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                                    <RollRow e={latest} />
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
                                            <ul
                                                className="m-0 mt-2 flex list-none flex-col gap-1.5 overflow-auto p-0"
                                                style={{ maxHeight: size.h }}
                                            >
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
                </>
            )}
        </div>
    )
}
