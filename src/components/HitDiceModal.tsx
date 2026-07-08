import { useEffect, useState } from 'react'
import { rollExpr } from '../model/dice'

export interface HitDieEntry {
    sectionId: string
    fieldId: string
    /** Die notation, e.g. "d10". */
    die: string
    available: number
    max: number
}

interface HitDiceModalProps {
    entries: HitDieEntry[]
    conMod: number
    onClose: () => void
    /** Apply the spend: decrement each chosen die pool and heal the rolled total. */
    onApply: (
        spends: { sectionId: string; fieldId: string; count: number }[],
        heal: number,
        detail: string,
    ) => void
}

/** A popup to spend hit dice on a short rest: pick how many of each die to roll,
 *  then it rolls each die + CON mod, heals the total, and decrements the pool. */
export function HitDiceModal({ entries, conMod, onClose, onApply }: HitDiceModalProps) {
    const [counts, setCounts] = useState<Record<string, number>>({})

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [onClose])

    const setCount = (id: string, value: number, max: number) =>
        setCounts((c) => ({ ...c, [id]: Math.max(0, Math.min(max, value)) }))

    const totalChosen = entries.reduce((sum, e) => sum + (counts[e.fieldId] || 0), 0)

    const spend = () => {
        const spends: { sectionId: string; fieldId: string; count: number }[] = []
        const parts: string[] = []
        let total = 0
        for (const e of entries) {
            const n = counts[e.fieldId] || 0
            if (n <= 0) continue
            spends.push({ sectionId: e.sectionId, fieldId: e.fieldId, count: n })
            for (let i = 0; i < n; i++) {
                const r = rollExpr(`1${e.die}`)
                const gained = Math.max(0, r.total + conMod)
                total += gained
                parts.push(`${e.die} ${r.total}${conMod >= 0 ? '+' : ''}${conMod} = ${gained}`)
            }
        }
        if (spends.length === 0) return
        onApply(spends, total, `Spent ${totalChosen} hit ${totalChosen === 1 ? 'die' : 'dice'} · ${parts.join(', ')} → +${total} HP`)
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Spend hit dice"
            onPointerDown={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
                <header className="flex items-center gap-2 border-b border-slate-700 px-4 py-3">
                    <h2 className="m-0 flex-1 text-base font-semibold text-slate-100">🎲 Spend hit dice</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-800"
                        aria-label="Close"
                    >
                        Cancel
                    </button>
                </header>
                <div className="flex flex-col gap-3 p-4">
                    <p className="m-0 text-xs text-slate-400">
                        Each die you spend heals its roll + your CON modifier ({conMod >= 0 ? '+' : ''}
                        {conMod}).
                    </p>
                    {entries.map((e) => {
                        const chosen = counts[e.fieldId] || 0
                        return (
                            <div key={e.fieldId} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/50 p-2">
                                <span className="font-mono text-sm font-semibold text-slate-100">{e.die}</span>
                                <span className="text-xs text-slate-400">
                                    {e.available} of {e.max} left
                                </span>
                                <div className="ml-auto flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setCount(e.fieldId, chosen - 1, e.available)}
                                        className="h-7 w-7 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                                        aria-label={`Fewer ${e.die}`}
                                    >
                                        −
                                    </button>
                                    <span className="w-6 text-center font-mono text-slate-100">{chosen}</span>
                                    <button
                                        type="button"
                                        onClick={() => setCount(e.fieldId, chosen + 1, e.available)}
                                        disabled={chosen >= e.available}
                                        className="h-7 w-7 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                                        aria-label={`More ${e.die}`}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                    <button
                        type="button"
                        onClick={spend}
                        disabled={totalChosen === 0}
                        className="mt-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        Roll {totalChosen > 0 ? `${totalChosen} ` : ''}& heal
                    </button>
                </div>
            </div>
        </div>
    )
}
