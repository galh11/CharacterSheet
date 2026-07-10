// Validate a generated CharacterSheet JSON file against the app's live zod
// schema, then run resolveSheet so formula/slug typos surface. Run from the repo
// root (needs the app's node_modules for `zod` + `esbuild`):
//
//   node .github/skills/build-character-sheet/scripts/validate-sheet.mjs samples/<slug>-sheet.json
//
// Exit code 0 = valid; 1 = invalid or usage error.
import { readFileSync, mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const sheetArg = process.argv[2]
if (!sheetArg) {
    console.error('Usage: node validate-sheet.mjs <path-to-sheet.json>')
    process.exit(1)
}

const repoRoot = process.cwd()
if (!existsSync(resolve(repoRoot, 'src/model/characterSheet.ts'))) {
    console.error('Run this from the repository root (src/model/characterSheet.ts not found).')
    process.exit(1)
}

let esbuild
try {
    esbuild = await import('esbuild')
} catch {
    console.error('Could not load esbuild. Run this from the repo root after `npm ci`.')
    process.exit(1)
}

// Bundle the schema + resolver (both pull in only local files + zod) into a
// temporary ESM module we can import at runtime. Specifiers are relative to
// resolveDir (the repo root) so esbuild resolves both the local TS and `zod`.
const entry = [
    `export { characterSheetSchema } from './src/model/characterSheet.ts'`,
    `export { resolveSheet } from './src/model/compute.ts'`,
].join('\n')

const outDir = mkdtempSync(join(tmpdir(), 'cs-validate-'))
const outFile = join(outDir, 'bundle.mjs')

try {
    await esbuild.build({
        stdin: { contents: entry, resolveDir: repoRoot, loader: 'ts' },
        bundle: true,
        platform: 'node',
        format: 'esm',
        outfile: outFile,
        logLevel: 'silent',
    })
} catch (err) {
    console.error('Could not bundle the schema/resolver:')
    console.error(err.message ?? err)
    process.exit(1)
}

const { characterSheetSchema, resolveSheet } = await import(pathToFileURL(outFile).href)

let raw
try {
    raw = JSON.parse(readFileSync(resolve(repoRoot, sheetArg), 'utf8'))
} catch (err) {
    console.error(`Could not read/parse ${sheetArg}: ${err.message}`)
    process.exit(1)
}

const parsed = characterSheetSchema.safeParse(raw)
if (!parsed.success) {
    console.error('❌ Schema validation failed:')
    for (const issue of parsed.error.issues) {
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
}

const sheet = parsed.data
const resolved = resolveSheet(sheet)
const scopeKeys = Object.keys(resolved.scope ?? {})

console.log(`✓ Valid: "${sheet.name}" — ${sheet.sections.length} sections, ${scopeKeys.length} computed slugs in scope.`)

// Surface any computed fields that resolved to NaN (usually a bad slug/formula).
const nanSlugs = scopeKeys.filter((k) => Number.isNaN(resolved.scope[k]))
if (nanSlugs.length) {
    console.warn(`⚠ ${nanSlugs.length} slug(s) resolved to NaN — check their formulas: ${nanSlugs.join(', ')}`)
}
