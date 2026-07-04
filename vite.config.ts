import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// Vitest configuration lives in vitest.config.ts (kept separate so this file
// type-checks cleanly under the app's build).
export default defineConfig(({ command }) => ({
    // Production builds are served from the repo-scoped GitHub Pages path;
    // dev (and Playwright's dev server) stay at root.
    base: command === 'build' ? '/CharacterSheet/' : '/',
    plugins: [
        react(),
        tailwindcss(),
        // Progressive Web App: generates a service worker (offline precache)
        // and a web manifest so the app can be installed to a home screen.
        VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'auto',
            includeAssets: ['favicon.svg'],
            manifest: {
                name: 'CharacterSheet — D&D Cheat Sheet',
                short_name: 'CharacterSheet',
                description: 'A crammed, interactive D&D 5e player cheat sheet.',
                theme_color: '#0f172a',
                background_color: '#0f172a',
                display: 'standalone',
                icons: [
                    { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
                    { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,woff2}'],
            },
        }),
    ],
}))
