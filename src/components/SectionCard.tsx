import { clsx } from 'clsx'
import type { FormulaResult } from '../model/formula'
import type { Contribution, EffectTag } from '../model/compute'
import type { D20Mode, RollLogEntry } from '../model/dice'
import { SectionBody } from './SectionBody'
import { SectionQuickEdit } from './SectionQuickEdit'
import { type CharacterField, type CharacterSection } from '../model/characterSheet'

interface SectionCardProps {
    section: CharacterSection
    results: Map<string, FormulaResult>
    contributions?: Map<string, Contribution[]>
    effectTags?: Map<string, EffectTag[]>
    scope?: Record<string, number>
    rollMode?: D20Mode
    bonus?: number
    bonusDie?: number
    repeat?: number
    onRoll?: (entry: Omit<RollLogEntry, 'id'>) => void
    onHeal?: (amount: number) => void
    onSpend?: (slug: string, amount: number) => void
    onRestore?: (refillSlug: string, costSlug?: string) => void
    onToggleFlag?: (slug: string) => void
    onTempHp?: (amount: number) => void
    collapsed?: boolean
    onToggleCollapse?: () => void
    pinned?: boolean
    onTogglePin?: () => void
    /** Open the per-section editor modal. */
    onEdit?: () => void
    /** Tuck this card into the drawer. */
    onHide?: () => void
    onUpdateSection: (
        patch: Partial<Pick<CharacterSection, 'title' | 'description' | 'accent' | 'kind' | 'scale' | 'meta'>>,
    ) => void
    onAddField: (overrides?: Partial<CharacterField>) => void
    onUpdateField: (fieldId: string, patch: Partial<CharacterField>) => void
}

export function SectionCard({
    section,
    results,
    contributions,
    effectTags,
    scope,
    rollMode,
    bonus,
    bonusDie,
    repeat,
    onRoll,
    onHeal,
    onSpend,
    onRestore,
    onToggleFlag,
    onTempHp,
    collapsed,
    onToggleCollapse,
    pinned,
    onTogglePin,
    onEdit,
    onHide,
    onUpdateSection,
    onAddField,
    onUpdateField,
}: SectionCardProps) {
    return (
        <article
            className="flex h-full min-h-full flex-col rounded-lg border border-slate-700 bg-slate-950/60 p-4"
            style={{ borderTopColor: section.accent, borderTopWidth: 3, zoom: section.scale }}
        >
            <header className="mb-2 flex items-start justify-between gap-2">
                {onToggleCollapse && (
                    <button
                        type="button"
                        onClick={onToggleCollapse}
                        className="shrink-0 rounded px-1 text-slate-400 hover:bg-slate-800"
                        aria-label={collapsed ? 'Expand section' : 'Collapse section'}
                        title={collapsed ? 'Expand' : 'Collapse'}
                    >
                        {collapsed ? '▸' : '▾'}
                    </button>
                )}
                {onTogglePin && (
                    <button
                        type="button"
                        onClick={onTogglePin}
                        className={clsx('shrink-0 rounded px-1 hover:bg-slate-800', pinned ? 'text-amber-300' : 'text-slate-500')}
                        aria-label={pinned ? 'Unpin section' : 'Pin section to top'}
                        title={pinned ? 'Unpin' : 'Pin to top'}
                    >
                        ★
                    </button>
                )}
                <h3 className="m-0 flex-1 text-base font-semibold text-slate-100">{section.title}</h3>
                {onEdit && (
                    <SectionQuickEdit
                        section={section}
                        onUpdateSection={onUpdateSection}
                        onEdit={onEdit}
                        className="shrink-0 rounded px-1 text-slate-400 opacity-60 hover:bg-slate-800 hover:text-slate-200 hover:opacity-100"
                    />
                )}
                {onHide && (
                    <button
                        type="button"
                        onClick={onHide}
                        className="shrink-0 rounded px-1 text-slate-400 opacity-60 hover:bg-slate-800 hover:text-slate-200 hover:opacity-100"
                        aria-label={`Move ${section.title} to drawer`}
                        title="Move to drawer"
                    >
                        ⊟
                    </button>
                )}
            </header>

            {!collapsed && (
                <>
                    {section.description && <p className="mt-0 mb-3 text-xs text-slate-400">{section.description}</p>}

                    <SectionBody
                        section={section}
                        results={results}
                        contributions={contributions}
                        effectTags={effectTags}
                        onUpdateField={onUpdateField}
                        onUpdateSection={onUpdateSection}
                        scope={scope}
                        rollMode={rollMode}
                        bonus={bonus}
                        bonusDie={bonusDie}
                        repeat={repeat}
                        onRoll={onRoll}
                        onHeal={onHeal}
                        onSpend={onSpend}
                        onRestore={onRestore}
                        onToggleFlag={onToggleFlag}
                        onTempHp={onTempHp}
                        onAddField={onAddField}
                    />
                </>
            )}
        </article>
    )
}
