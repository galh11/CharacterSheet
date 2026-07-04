import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Vitest (unit/component) configuration. Kept separate from vite.config.ts so
 * the app's `tsc -b` build stays clean, while Vitest still auto-loads this file.
 */
export default defineConfig({
    plugins: [react()],
    test: {
        // Run tests in a browser-like DOM so we can render components.
        environment: 'jsdom',
        // Allow describe/it/expect without importing them in every test.
        globals: true,
        // Loads jest-dom matchers and cleans up the DOM between tests.
        setupFiles: ['./src/test/setup.ts'],
        css: true,
        // e2e/ holds Playwright specs, which run in a real browser — not Vitest.
        exclude: [...configDefaults.exclude, 'e2e/**'],
    },
})
