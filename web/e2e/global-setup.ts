import { chromium } from '@playwright/test'
import { TEST_USERS } from './fixtures/auth.fixtures'
import { resetDatabase } from './helpers/api.helpers'
import path from 'path'
import fs from 'fs'

export default async function globalSetup() {
  // Reset DB
  console.log('[setup] Resetting test database...')
  await resetDatabase()

  // Create .auth dir
  const authDir = path.join(__dirname, '.auth')
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true })

  const browser = await chromium.launch()

  const toAuth = [
    { key: 'owner', creds: TEST_USERS.owner },
    { key: 'admin', creds: TEST_USERS.admin },
    { key: 'staff', creds: TEST_USERS.staff },
    { key: 'leader', creds: TEST_USERS.leader },
    { key: 'participant', creds: TEST_USERS.participant },
  ]

  for (const { key, creds } of toAuth) {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()

    await page.goto('http://localhost:3000/login')
    await page.locator('[type="email"]').fill(creds.email)
    await page.locator('[type="password"]').fill(creds.password)
    await page.click('button:has-text("Sign in")')
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 12000 })

    await ctx.storageState({ path: path.join(authDir, `${key}.json`) })
    await ctx.close()
    console.log(`[setup] Auth saved: ${key}`)
  }

  // Save guest (unauthenticated) state
  const guestCtx = await browser.newContext()
  await guestCtx.storageState({ path: path.join(authDir, 'guest.json') })
  await guestCtx.close()

  await browser.close()
  console.log('[setup] Global setup complete.')
}
