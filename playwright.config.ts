import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests: these drive a REAL browser (Chromium) against the running
 * app to verify full user flows like dragging a section on the canvas.
 * Docs: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
    testDir: './e2e',
    // Fail the build on CI if a test.only is accidentally committed.
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: 'html',
    // Visual snapshots: allow a tiny amount of anti-aliasing noise so tests
    // don't flag sub-pixel font-rendering differences as real changes.
    expect: {
        toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
    },
    use: {
        baseURL: 'http://localhost:5173',
        // Capture a trace (a step-by-step recording) when a test is retried.
        trace: 'on-first-retry',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
    // Start the Vite dev server automatically before running the tests.
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
    },
})
