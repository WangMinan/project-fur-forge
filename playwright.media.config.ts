import { defineConfig } from '@playwright/test'
import smoke from './playwright.smoke.config'

export default defineConfig({
  ...smoke,
  testMatch: ['public-image-containment.spec.ts', 'work-gallery-motion.spec.ts'],
  use: { ...smoke.use, channel: undefined },
  projects: [
    { name: 'chrome', use: { browserName: 'chromium', channel: 'chrome' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
})
