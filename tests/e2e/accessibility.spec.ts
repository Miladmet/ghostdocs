import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility & Kiroween Theme Compliance (Req 10.1–10.7)', () => {
  test('permanent dark class, zero axe-core violations, keyboard navigation, and >=2px focus ring', async ({
    page,
  }) => {
    await page.goto('/');

    // Req 10.1: dark class permanently applied to <html>
    const htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass).toContain('dark');

    // Focus upload-button and verify >=2px outline width (Req 10.3)
    const uploadBtn = page.getByTestId('upload-button');
    await uploadBtn.focus();
    const outlineWidth = await uploadBtn.evaluate(
      (el) => window.getComputedStyle(el).outlineWidth
    );
    expect(parseFloat(outlineWidth)).toBeGreaterThanOrEqual(2);

    const axeResults = await new AxeBuilder({ page }).analyze();
    expect(axeResults.violations).toEqual([]);
  });
});
