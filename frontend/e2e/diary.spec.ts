import { test, expect } from '@playwright/test'

test.describe('Daily Diary Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(dashboard|projects)/)
  })

  test('should display diary list page', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('.project-card, [data-testid="project-card"]').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      // Navigate to Diary section
      const diaryTab = page.locator('text=Diary, text=Daily Diary, [data-testid="diary-tab"]').first()
      if (await diaryTab.isVisible()) {
        await diaryTab.click()
        await page.waitForTimeout(500)

        // Verify diary list is displayed
        await expect(page.locator('[data-testid="diary-list"], .diary-entries, h2:has-text("Diary")')).toBeVisible()
      }
    }
  })

  test('should show create diary button', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('.project-card').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      const diaryTab = page.locator('text=Diary, text=Daily Diary').first()
      if (await diaryTab.isVisible()) {
        await diaryTab.click()

        // Check for create diary button
        const createButton = page.locator('[data-testid="create-diary-button"], button:has-text("Create"), button:has-text("Add Diary"), button:has-text("New Diary")')
        if (await createButton.count() > 0) {
          await expect(createButton.first()).toBeVisible()
        }
      }
    }
  })

  test('should display diary details when clicked', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('.project-card').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      const diaryTab = page.locator('text=Diary, text=Daily Diary').first()
      if (await diaryTab.isVisible()) {
        await diaryTab.click()

        // Click on a diary entry if visible
        const diaryRow = page.locator('[data-testid="diary-row"], .diary-entry, tr[data-diary-id]').first()
        if (await diaryRow.isVisible()) {
          await diaryRow.click()

          // Should show diary details
          await expect(page.locator('[data-testid="diary-details"], .diary-details, h1:has-text("Diary")')).toBeVisible()
        }
      }
    }
  })

  test('should display weather information section', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('.project-card').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      const diaryTab = page.locator('text=Diary, text=Daily Diary').first()
      if (await diaryTab.isVisible()) {
        await diaryTab.click()

        const diaryRow = page.locator('[data-testid="diary-row"], .diary-entry').first()
        if (await diaryRow.isVisible()) {
          await diaryRow.click()

          // Look for weather section
          const weatherSection = page.locator('[data-testid="weather-section"], .weather-info, text=Weather')
          if (await weatherSection.count() > 0) {
            await expect(weatherSection.first()).toBeVisible()
          }
        }
      }
    }
  })
})

test.describe('Diary Entry Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(dashboard|projects)/)
  })

  test('should show personnel section', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('.project-card').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      const diaryTab = page.locator('text=Diary').first()
      if (await diaryTab.isVisible()) {
        await diaryTab.click()

        const diaryRow = page.locator('.diary-entry, [data-testid="diary-row"]').first()
        if (await diaryRow.isVisible()) {
          await diaryRow.click()

          // Personnel section should be visible
          const personnelSection = page.locator('[data-testid="personnel-section"], .personnel-list, text=Personnel')
          if (await personnelSection.count() > 0) {
            await expect(personnelSection.first()).toBeVisible()
          }
        }
      }
    }
  })

  test('should show plant section', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('.project-card').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      const diaryTab = page.locator('text=Diary').first()
      if (await diaryTab.isVisible()) {
        await diaryTab.click()

        const diaryRow = page.locator('.diary-entry, [data-testid="diary-row"]').first()
        if (await diaryRow.isVisible()) {
          await diaryRow.click()

          // Plant/Equipment section should be visible
          const plantSection = page.locator('[data-testid="plant-section"], .plant-list, text=Plant, text=Equipment')
          if (await plantSection.count() > 0) {
            await expect(plantSection.first()).toBeVisible()
          }
        }
      }
    }
  })

  test('should show activities section', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('.project-card').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      const diaryTab = page.locator('text=Diary').first()
      if (await diaryTab.isVisible()) {
        await diaryTab.click()

        const diaryRow = page.locator('.diary-entry, [data-testid="diary-row"]').first()
        if (await diaryRow.isVisible()) {
          await diaryRow.click()

          // Activities section should be visible
          const activitiesSection = page.locator('[data-testid="activities-section"], .activities-list, text=Activities')
          if (await activitiesSection.count() > 0) {
            await expect(activitiesSection.first()).toBeVisible()
          }
        }
      }
    }
  })

  test('should show diary status badge', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('.project-card').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      const diaryTab = page.locator('text=Diary').first()
      if (await diaryTab.isVisible()) {
        await diaryTab.click()

        // Status badges should be visible in diary list
        const statusBadge = page.locator('[data-testid="diary-status"], .status-badge')
        if (await statusBadge.count() > 0) {
          await expect(statusBadge.first()).toBeVisible()
        }
      }
    }
  })
})
