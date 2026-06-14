import { z } from 'zod'

export const sectionSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
})

export const characterSheetSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    sections: z.array(sectionSchema),
})

export type CharacterSection = z.infer<typeof sectionSchema>
export type CharacterSheet = z.infer<typeof characterSheetSchema>

export const createStarterSheet = (): CharacterSheet => ({
    id: crypto.randomUUID(),
    name: 'New Character',
    sections: [
        {
            id: crypto.randomUUID(),
            title: 'Core Stats',
            description: 'Ability scores, proficiency bonus, initiative, and AC.',
        },
        {
            id: crypto.randomUUID(),
            title: 'Resources',
            description: 'Hit points, hit dice, spell slots, and class feature charges.',
        },
    ],
})

export const createSection = (index: number): CharacterSection => ({
    id: crypto.randomUUID(),
    title: `Custom Section ${index + 1}`,
    description: 'Add section details and start modeling this block.',
})

