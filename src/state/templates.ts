import type { CharacterField, SectionKind } from '../model/characterSheet'

/** A ready-made section the user can drop onto the canvas from the toolbar. */
export interface SectionTemplate {
    id: string
    label: string
    title: string
    kind: SectionKind
    fields: Partial<CharacterField>[]
}

export const SECTION_TEMPLATES: SectionTemplate[] = [
    {
        id: 'attacks',
        label: 'Attacks',
        title: 'Attacks',
        kind: 'actions',
        fields: [
            {
                label: 'Attack',
                type: 'text',
                value: '',
                description: 'A weapon or unarmed strike.',
                meta: { hit: '{prof + str_mod}', damage: '1d8+{str_mod}', type: 'slashing' },
            },
        ],
    },
    {
        id: 'spellcasting',
        label: 'Spellcasting',
        title: 'Spell Slots',
        kind: 'spellslots',
        fields: [
            { label: '1st Level', type: 'resource', value: '0', description: '1st-level spell slots.' },
            { label: '2nd Level', type: 'resource', value: '0', description: '2nd-level spell slots.' },
            { label: '3rd Level', type: 'resource', value: '0', description: '3rd-level spell slots.' },
        ],
    },
    {
        id: 'conditions',
        label: 'Conditions',
        title: 'Conditions',
        kind: 'conditions',
        fields: [],
    },
    {
        id: 'timers',
        label: 'Buff timers',
        title: 'Buff Timers',
        kind: 'timers',
        fields: [],
    },
    {
        id: 'inventory',
        label: 'Inventory',
        title: 'Inventory',
        kind: 'inventory',
        fields: [
            { label: 'CP', type: 'number', value: '0', description: 'Copper pieces.', meta: { coin: 'cp' } },
            { label: 'SP', type: 'number', value: '0', description: 'Silver pieces.', meta: { coin: 'sp' } },
            { label: 'GP', type: 'number', value: '0', description: 'Gold pieces.', meta: { coin: 'gp' } },
            { label: 'Backpack', type: 'text', value: '', description: 'A mundane item — set its value to a quantity or worn/carried status.' },
        ],
    },
    {
        id: 'notes',
        label: 'Notes',
        title: 'Notes',
        kind: 'default',
        fields: [{ label: 'Note', type: 'text', value: '', description: '' }],
    },
]
