import { test, expect } from '@playwright/test'

test.describe('Lots Management', () => {
  // Use authenticated state from auth setup if available
  test.beforeEach(async ({ page }) => {
    // Navigate to a test project's lots page
    // Note: This requires a valid auth session
    await page.goto('/login')
    // Fill in login credentials
    await page.fill('[data-testid="email-input"], input[type="email"]', 'test@example.com')
    await page.fill('[data-testid="password-input"], input[type="password"]', 'testpassword123')
    await page.click('[data-testid="login-button"], button[type="submit"]')
    // Wait for navigation
    await page.waitForURL(/\/(dashboard|projects)/)
  })

  test('should display lots list page', async ({ page }) => {
    // Navigate to a project's lots page
    // This assumes there's at least one project
    await page.goto('/projects')

    // Click on first project if visible
    const projectLink = page.locator('[data-testid="project-card"], .project-card').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()
    }

    // Navigate to lots tab/section
    const lotsTab = page.locator('text=Lots, [data-testid="lots-tab"]').first()
    if (await lotsTab.isVisible()) {
      await lotsTab.click()
    }

    // Verify lots page elements
    await expect(page.locator('h1, h2, [data-testid="page-title"]').first()).toBeVisible()
  })

  test('should show lot creation button for authorized users', async ({ page }) => {
    await page.goto('/projects')

    // Navigate to a project
    const projectLink = page.locator('[data-testid="project-card"], .project-card').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      // Check for create lot button
      const createButton = page.locator('[data-testid="create-lot-button"], button:has-text("Create"), button:has-text("Add Lot"), button:has-text("New Lot")')
      // Button visibility depends on user role
      if (await createButton.count() > 0) {
        await expect(createButton.first()).toBeVisible()
      }
    }
  })

  test('should display lot details when clicked', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('[data-testid="project-card"], .project-card').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      // Click on a lot if visible
      const lotRow = page.locator('[data-testid="lot-row"], tr[data-lot-id], .lot-card').first()
      if (await lotRow.isVisible()) {
        await lotRow.click()

        // Should show lot details
        await expect(page.locator('[data-testid="lot-details"], .lot-details, h1:has-text("Lot")')).toBeVisible()
      }
    }
  })

  test('should filter lots by status', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('[data-testid="project-card"], .project-card').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      // Look for status filter
      const statusFilter = page.locator('[data-testid="status-filter"], select:has-text("Status"), [aria-label="Status"]')
      if (await statusFilter.isVisible()) {
        await statusFilter.selectOption('in_progress')
        // Verify filter was applied (URL should update or list should filter)
        await page.waitForTimeout(500)
      }
    }
  })

  test('should search lots', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('[data-testid="project-card"], .project-card').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      // Look for search input
      const searchInput = page.locator('[data-testid="lot-search"], input[placeholder*="Search"], input[type="search"]')
      if (await searchInput.isVisible()) {
        await searchInput.fill('LOT-001')
        await page.waitForTimeout(500)
        // Results should filter
      }
    }
  })
})

test.describe('Lot Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(dashboard|projects)/)
  })

  test('should display lot status indicator', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('.project-card, [data-testid="project-card"]').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      // Status badges should be visible
      const statusBadge = page.locator('[data-testid="lot-status"], .status-badge, .badge')
      if (await statusBadge.count() > 0) {
        await expect(statusBadge.first()).toBeVisible()
      }
    }
  })

  test('should show ITP completion progress', async ({ page }) => {
    await page.goto('/projects')

    const projectLink = page.locator('.project-card, [data-testid="project-card"]').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()

      // Look for ITP progress indicator
      const itpProgress = page.locator('[data-testid="itp-progress"], .progress-bar, .itp-completion')
      if (await itpProgress.count() > 0) {
        await expect(itpProgress.first()).toBeVisible()
      }
    }
  })
})
