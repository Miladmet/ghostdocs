import path from 'path';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

test.describe('Semantic Search (Req 3.1–3.9, R-PBT-8)', () => {
  test('happy path & Property 7 (Search Determinism): returns identical ranked results within budget', async ({
    page,
  }) => {
    await page.goto('/');

    await page
      .getByTestId('upload-input')
      .setInputFiles(path.join(FIXTURES_DIR, 'sample.md'));
    await expect(page.getByTestId('document-card-sample')).toBeVisible({
      timeout: 15000,
    });

    const searchInput = page.getByTestId('search-input');
    const searchSubmit = page.getByTestId('search-submit');

    await searchInput.fill('Q3 budget allocation');
    await searchSubmit.click();

    const firstRunItems = page.locator('[data-testid^="search-result-"]');
    await expect(firstRunItems.first()).toBeVisible({ timeout: 5000 });
    const firstTexts = await firstRunItems.allInnerTexts();

    // Submit identical query a second time (R-PBT-8 determinism)
    await searchInput.fill('Q3 budget allocation');
    await searchSubmit.click();
    await expect(firstRunItems.first()).toBeVisible();
    const secondTexts = await firstRunItems.allInnerTexts();

    expect(secondTexts).toEqual(firstTexts);

    const axeResults = await new AxeBuilder({ page }).analyze();
    expect(axeResults.violations).toEqual([]);
  });

  test('whitespace query rejection (Req 3.4, Property 11) and empty corpus notice (Req 3.5)', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.getByTestId('search-empty-state')).toBeVisible();

    await page.getByTestId('search-input').fill('   ');
    await page.getByTestId('search-submit').click();

    await expect(page.getByTestId('search-error')).toBeVisible();
  });
});
