import { test, expect } from '@playwright/test';

test.describe('frontend error handling utilities', () => {
  test('handles null API error payloads when extracting details and codes', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const [{ ApiError }, { extractErrorCode, extractErrorDetails }] = await Promise.all([
        import('/src/lib/api.ts'),
        import('/src/lib/errorHandling.ts'),
      ]);
      const error = new ApiError(400, JSON.stringify({ error: null }));

      return {
        details: extractErrorDetails(error),
        code: extractErrorCode(error),
      };
    });

    expect(result).toEqual({ details: null, code: null });
  });
});
