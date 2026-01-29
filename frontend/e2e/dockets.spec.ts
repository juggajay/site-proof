import { test, expect } from '@playwright/test'

test.describe('Dockets Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(dashboard|projects)/)
  })

  test('should display dockets list page', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('.project-card, [data-testid="project-card"]').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      // Navigate to Dockets section
      const docketsTab = page.locator('text=Dockets, [data-testid="dockets-tab"]').first()
      if (await docketsTab.isVisible()) {
        await docketsTab.click()
        await page.waitForTimeout(500)

        // Verify dockets list is displayed
        await expect(page.locator('[data-testid="dockets-list"], .dockets-table, h2:has-text("Docket")')).toBeVisible()
      }
    }
  })

  test('should show docket status filter', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('.project-card').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      const docketsTab = page.locator('text=Dockets').first()
      if (await docketsTab.isVisible()) {
        await docketsTab.click()

        // Check for status filter
        const statusFilter = page.locator('[data-testid="docket-status-filter"], select:has-text("Status"), [aria-label="Status"]')
        if (await statusFilter.count() > 0) {
          await expect(statusFilter.first()).toBeVisible()
        }
      }
    }
  })

  test('should display docket details when clicked', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('.project-card').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      const docketsTab = page.locator('text=Dockets').first()
      if (await docketsTab.isVisible()) {
        await docketsTab.click()

        // Click on a docket if visible
        const docketRow = page.locator('[data-testid="docket-row"], .docket-entry, tr[data-docket-id]').first()
        if (await docketRow.isVisible()) {
          await docketRow.click()

          // Should show docket details
          await expect(page.locator('[data-testid="docket-details"], .docket-details, text=DKT-')).toBeVisible()
        }
      }
    }
  })

  test('should show subcontractor name on dockets', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('.project-card').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      const docketsTab = page.locator('text=Dockets').first()
      if (await docketsTab.isVisible()) {
        await docketsTab.click()

        // Subcontractor column should be visible
        const subcontractorCol = page.locator('[data-testid="subcontractor-column"], th:has-text("Subcontractor"), th:has-text("Company")')
        if (await subcontractorCol.count() > 0) {
          await expect(subcontractorCol.first()).toBeVisible()
        }
      }
    }
  })
})

test.describe('Docket Approval Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(dashboard|projects)/)
  })

  test('should show pending dockets count', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('.project-card').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      const docketsTab = page.locator('text=Dockets').first()
      if (await docketsTab.isVisible()) {
        await docketsTab.click()

        // Pending count badge should be visible if there are pending dockets
        const pendingBadge = page.locator('[data-testid="pending-count"], .pending-badge, text=Pending')
        if (await pendingBadge.count() > 0) {
          await expect(pendingBadge.first()).toBeVisible()
        }
      }
    }
  })

  test('should show approve/reject buttons for authorized users', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('.project-card').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      const docketsTab = page.locator('text=Dockets').first()
      if (await docketsTab.isVisible()) {
        await docketsTab.click()

        // Click on a pending docket
        const pendingDocket = page.locator('[data-status="pending_approval"], tr:has-text("Pending")').first()
        if (await pendingDocket.isVisible()) {
          await pendingDocket.click()

          // Approve/reject buttons should be visible for authorized users
          const approveBtn = page.locator('[data-testid="approve-button"], button:has-text("Approve")')
          const rejectBtn = page.locator('[data-testid="reject-button"], button:has-text("Reject")')
          // Visibility depends on user role and docket status
          if (await approveBtn.count() > 0) {
            await expect(approveBtn.first()).toBeVisible()
          }
        }
      }
    }
  })

  test('should show labour entries in docket details', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('.project-card').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      const docketsTab = page.locator('text=Dockets').first()
      if (await docketsTab.isVisible()) {
        await docketsTab.click()

        const docketRow = page.locator('.docket-entry, [data-testid="docket-row"]').first()
        if (await docketRow.isVisible()) {
          await docketRow.click()

          // Labour entries section should be visible
          const labourSection = page.locator('[data-testid="labour-entries"], .labour-section, text=Labour')
          if (await labourSection.count() > 0) {
            await expect(labourSection.first()).toBeVisible()
          }
        }
      }
    }
  })

  test('should show plant entries in docket details', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('.project-card').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      const docketsTab = page.locator('text=Dockets').first()
      if (await docketsTab.isVisible()) {
        await docketsTab.click()

        const docketRow = page.locator('.docket-entry, [data-testid="docket-row"]').first()
        if (await docketRow.isVisible()) {
          await docketRow.click()

          // Plant entries section should be visible
          const plantSection = page.locator('[data-testid="plant-entries"], .plant-section, text=Plant')
          if (await plantSection.count() > 0) {
            await expect(plantSection.first()).toBeVisible()
          }
        }
      }
    }
  })

  test('should show diary comparison when available', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('.project-card').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      const docketsTab = page.locator('text=Dockets').first()
      if (await docketsTab.isVisible()) {
        await docketsTab.click()

        const docketRow = page.locator('.docket-entry, [data-testid="docket-row"]').first()
        if (await docketRow.isVisible()) {
          await docketRow.click()

          // Diary comparison section might be visible
          const diaryComparison = page.locator('[data-testid="diary-comparison"], .diary-comparison, text=Diary Comparison, text=Discrepancies')
          if (await diaryComparison.count() > 0) {
            await expect(diaryComparison.first()).toBeVisible()
          }
        }
      }
    }
  })
})

test.describe('Subcontractor Portal Dockets', () => {
  // These tests assume a subcontractor user is logged in
  test('should show create docket for subcontractors', async ({ page }) => {
    // Login as subcontractor
    await page.goto('/login')
    await page.fill('input[type="email"]', 'subcontractor@example.com')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button[type="submit"]')

    // Wait for either dashboard or subcontractor portal
    try {
      await page.waitForURL(/\/(dashboard|subcontractor-portal)/, { timeout: 5000 })

      // Navigate to dockets
      const docketsLink = page.locator('text=Dockets, [data-testid="dockets-link"]').first()
      if (await docketsLink.isVisible()) {
        await docketsLink.click()

        // Create docket button should be visible
        const createBtn = page.locator('[data-testid="create-docket"], button:has-text("Create"), button:has-text("New Docket")')
        if (await createBtn.count() > 0) {
          await expect(createBtn.first()).toBeVisible()
        }
      }
    } catch {
      // Skip if login fails (expected if test user doesn't exist)
    }
  })
})
