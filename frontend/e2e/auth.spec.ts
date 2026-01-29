import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
  })

  test('should show registration page', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByRole('heading', { name: /create.*account/i })).toBeVisible()
  })

  test('should validate login form', async ({ page }) => {
    await page.goto('/login')

    // Try to submit empty form
    await page.getByRole('button', { name: /sign in/i }).click()

    // Should show validation messages
    await expect(page.locator('text=/email|required/i')).toBeVisible()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel(/email/i).fill('invalid@example.com')
    await page.getByLabel(/password/i).fill('wrongpassword123')
    await page.getByRole('button', { name: /sign in/i }).click()

    // Should show error message
    await expect(page.locator('text=/invalid|error|incorrect/i')).toBeVisible({ timeout: 10000 })
  })

  test('should validate registration form', async ({ page }) => {
    await page.goto('/register')

    // Fill weak password
    await page.getByLabel(/email/i).fill('test@example.com')
    await page.getByLabel(/password/i).first().fill('weak')

    // Should show password requirements
    await page.getByRole('button', { name: /create|register|sign up/i }).click()
    await expect(page.locator('text=/password.*character|12|uppercase|lowercase|number|special/i')).toBeVisible({ timeout: 5000 })
  })

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/projects')

    // Should redirect to login
    await expect(page).toHaveURL(/login/)
  })

  test('should have forgot password link', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('link', { name: /forgot.*password/i })).toBeVisible()
  })
})

test.describe('Login Flow', () => {
  test('login page should have all required elements', async ({ page }) => {
    await page.goto('/login')

    // Check for email input
    await expect(page.getByLabel(/email/i)).toBeVisible()

    // Check for password input
    await expect(page.getByLabel(/password/i)).toBeVisible()

    // Check for submit button
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()

    // Check for register link
    await expect(page.getByRole('link', { name: /register|sign up|create.*account/i })).toBeVisible()
  })
})

test.describe('Registration Flow', () => {
  test('registration page should have all required elements', async ({ page }) => {
    await page.goto('/register')

    // Check for name input
    await expect(page.getByLabel(/name/i)).toBeVisible()

    // Check for email input
    await expect(page.getByLabel(/email/i)).toBeVisible()

    // Check for password input
    await expect(page.getByLabel(/password/i).first()).toBeVisible()

    // Check for Terms checkbox or link
    await expect(page.locator('text=/terms|agree/i')).toBeVisible()
  })
})
