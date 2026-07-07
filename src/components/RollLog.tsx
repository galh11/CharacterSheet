import { useState } from 'react'
import { clsx } from 'clsx'
import type { D20Mode, RollLogEntry } from '../model/dice'

interface RollLogProps {
    entries: RollLogEntry[]
    rollMode: D20Mode
    onRollModeChange: (mode: D20Mode) => void
    bonus: number
    onBonusChange: (bonus: number) => void
    luck?: number
    onSpendLuck: () => void
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

/** Floating panel showing recent dice rolls plus the advantage/disadvantage toggle. */
export function RollLog({ entries, rollMode, onRollModeChange, bonus, onBonusChange, luck, onSpendLuck, onClear }: RollLogProps) {
    const [open, setOpen] = useState(true)
    return (
        <div className="fixed bottom-4 right-4 z-40 w-72 rounded-xl border border-slate-700 bg-slate-950/95 shadow-xl backdrop-blur print:hidden">
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
                                title="Spend a Luck Point (Advantage / reroll)"
                            >
                                🍀 Luck ({luck})
                            </button>
                        )}
                    </div>
                    <div className="max-h-64 overflow-auto px-3 py-2">
                        {entries.length === 0 ? (
                            <p className="m-0 text-xs italic text-slate-500">Click an attack, skill, save or hit die to roll.</p>
                        ) : (
                            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                                {entries.map((e) => (
                                    <li key={e.id} className="flex items-start gap-2 border-b border-slate-800/60 pb-1.5 last:border-0">
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
                                ))}
                            </ul>
                        )}
                        {entries.length > 0 && (
                            <button
                                type="button"
                                onClick={onClear}
                                className="mt-2 w-full rounded border border-slate-700 py-1 text-[11px] text-slate-400 hover:bg-slate-800"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
