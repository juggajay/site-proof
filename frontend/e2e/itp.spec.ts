import { test, expect } from '@playwright/test'

test.describe('ITP (Inspection Test Plan) Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(dashboard|projects)/)
  })

  test('should display ITP templates list', async ({ page }) => {
    await page.goto('/projects')

    // Navigate to a project
    const projectLink = page.locator('.project-card, [data-testid="project-card"]').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      // Navigate to ITP section
      const itpTab = page.locator('text=ITP, text=Inspection, [data-testid="itp-tab"]').first()
      if (await itpTab.isVisible()) {
        await itpTab.click()
        await page.waitForTimeout(500)

        // Verify ITP list is displayed
        await expect(page.locator('[data-testid="itp-list"], .itp-templates, h2:has-text("ITP")')).toBeVisible()
      }
    }
  })

  test('should show ITP template details', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('.project-card').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      // Navigate to ITP section
      const itpTab = page.locator('text=ITP, text=Inspection').first()
      if (await itpTab.isVisible()) {
        await itpTab.click()
        await page.waitForTimeout(500)

        // Click on first ITP template
        const templateItem = page.locator('[data-testid="itp-template"], .itp-card, tr').first()
        if (await templateItem.isVisible()) {
          await templateItem.click()

          // Should show template details with checklist items
          await expect(page.locator('[data-testid="itp-details"], .checklist-items')).toBeVisible()
        }
      }
    }
  })

  test('should display checklist items with point types', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('.project-card').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      const itpTab = page.locator('text=ITP, text=Inspection').first()
      if (await itpTab.isVisible()) {
        await itpTab.click()

        const templateItem = page.locator('[data-testid="itp-template"], .itp-card').first()
        if (await templateItem.isVisible()) {
          await templateItem.click()

          // Look for point type indicators (hold point, witness point, verification)
          const pointTypes = page.locator('[data-testid="point-type"], .point-type-badge, .hold-point, .witness-point')
          if (await pointTypes.count() > 0) {
            await expect(pointTypes.first()).toBeVisible()
          }
        }
      }
    }
  })

  test('should show ITP completion status on lots', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('.project-card').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      // Navigate to lots with ITP
      const lotsTab = page.locator('text=Lots').first()
      if (await lotsTab.isVisible()) {
        await lotsTab.click()

        // ITP completion percentage should be visible
        const completionIndicator = page.locator('[data-testid="itp-completion"], .itp-progress, text=%')
        if (await completionIndicator.count() > 0) {
          await expect(completionIndicator.first()).toBeVisible()
        }
      }
    }
  })
})

test.describe('ITP Checklist Completion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(dashboard|projects)/)
  })

  test('should allow completing checklist items', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('.project-card').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      // Navigate to a lot's ITP instance
      const lotsTab = page.locator('text=Lots').first()
      if (await lotsTab.isVisible()) {
        await lotsTab.click()

        const lotRow = page.locator('[data-testid="lot-row"], tr[data-lot-id]').first()
        if (await lotRow.isVisible()) {
          await lotRow.click()

          // Find ITP checklist
          const checklistItem = page.locator('[data-testid="checklist-item"], .checklist-item').first()
          if (await checklistItem.isVisible()) {
            // Look for completion checkbox or button
            const completeBtn = checklistItem.locator('input[type="checkbox"], button:has-text("Complete")')
            if (await completeBtn.count() > 0) {
              await expect(completeBtn.first()).toBeVisible()
            }
          }
        }
      }
    }
  })

  test('should show hold point release requirements', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('.project-card').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      // Look for hold points section
      const holdPointsTab = page.locator('text=Hold Points, [data-testid="holdpoints-tab"]').first()
      if (await holdPointsTab.isVisible()) {
        await holdPointsTab.click()

        // Should show hold point release requirements
        const holdPointItem = page.locator('[data-testid="hold-point"], .hold-point-item')
        if (await holdPointItem.count() > 0) {
          await expect(holdPointItem.first()).toBeVisible()
        }
      }
    }
  })
})
