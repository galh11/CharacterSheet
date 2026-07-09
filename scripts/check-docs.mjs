// Docs freshness guard: every non-test source file under src/ must be named in
// AGENTS.md's "Project structure" map. This catches the drift where new modules
// are added (or files renamed) without updating the agent-facing docs.
//
// Run: `node scripts/check-docs.mjs` (also wired up as `npm run check:docs` and
// enforced in CI). It only checks the forward direction (every file is
// documented); when you remove a file, delete its line from AGENTS.md too.
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, relative, basename } from 'node:path'

const ROOT = process.cwd()
const agents = readFileSync(join(ROOT, 'AGENTS.md'), 'utf8')

const SOURCE_EXT = /\.(ts|tsx)$/
const IGNORE = /\.test\.(ts|tsx)$|\.d\.ts$/

const walk = (dir) => {
    const out = []
    for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) out.push(...walk(full))
        else if (SOURCE_EXT.test(name) && !IGNORE.test(name)) out.push(full)
    }
    return out
}

const files = walk(join(ROOT, 'src'))
const missing = files
    .filter((file) => !agents.includes(basename(file)))
    .map((file) => relative(ROOT, file).replace(/\\/g, '/'))

if (missing.length > 0) {
    console.error('✗ AGENTS.md is out of date — these source files are not in its project structure map:\n')
    for (const file of missing) console.error(`    ${file}`)
    console.error(
        '\nAdd each to the "Project structure" block in AGENTS.md. If the change is architectural,' +
            '\nalso update the Architecture notes there plus README.md / PLAN.md.\n',
    )
    process.exit(1)
}

console.log(`✓ Docs check passed — all ${files.length} source files are referenced in AGENTS.md.`)
