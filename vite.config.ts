import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// Vitest configuration lives in vitest.config.ts (kept separate so this file
// type-checks cleanly under the app's build).
export default defineConfig(({ command }) => ({
    // Production builds are served from the repo-scoped GitHub Pages path;
    // dev (and Playwright's dev server) stay at root.
    base: command === 'build' ? '/CharacterSheet/' : '/',
    plugins: [react(), tailwindcss()],
}))
