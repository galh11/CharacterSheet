import { SECTION_TEMPLATES, type SectionTemplate } from '../state/templates'

interface EmptyCanvasProps {
    /** Add a fresh blank section. */
    onAddSection: () => void
    /** Add a section from a ready-made template. */
    onAddTemplate: (template: SectionTemplate) => void
}

/** Shown in the canvas/stack slot when a character has zero sections — a friendly
 *  call to action so a brand-new (or fully-cleared) sheet isn't just a blank void.
 *  Mirrors the rail's add controls: a primary "+ Section" plus quick template picks. */
export function EmptyCanvas({ onAddSection, onAddTemplate }: EmptyCanvasProps) {
    return (
        <div className="mx-auto flex max-w-lg flex-col items-center gap-5 rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/10 text-violet-300">
                <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                    <path d="M17.5 14v7M14 17.5h7" strokeLinecap="round" />
                </svg>
            </div>
            <div className="flex flex-col gap-1">
                <h2 className="m-0 text-lg font-semibold text-slate-200">Your sheet is empty</h2>
                <p className="m-0 text-sm text-slate-400">
                    Add a section to start building your character — a blank one, or a ready-made template.
                </p>
            </div>
            <button
                type="button"
                onClick={onAddSection}
                className="rounded-md bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400"
            >
                + Section
            </button>
            <div className="flex w-full flex-col items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">or start from a template</span>
                <div className="flex flex-wrap justify-center gap-2">
                    {SECTION_TEMPLATES.map((template) => (
                        <button
                            key={template.id}
                            type="button"
                            onClick={() => onAddTemplate(template)}
                            className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-300 hover:border-violet-400 hover:text-violet-200"
                        >
                            {template.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
