import path from 'path';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

test.describe('Document Management & Deletion Completeness (Req 7.1–7.6, R-PBT-9)', () => {
  test('deletes document via confirmation dialog and removes all associated chunks from search', async ({
    page,
  }) => {
    await page.goto('/');

    await page
      .getByTestId('upload-input')
      .setInputFiles(path.join(FIXTURES_DIR, 'sample.md'));
    const docCard = page.getByTestId('document-card-sample');
    await expect(docCard).toBeVisible({ timeout: 15000 });

    // Click delete button and confirm
    await page.getByTestId('delete-document-sample').click();
    const dialog = page.getByTestId('delete-confirm-dialog');
    await expect(dialog).toBeVisible();

    await page.getByTestId('delete-confirm-button').click();
    await expect(docCard).toBeHidden();

    // Verify empty states appear when last document is deleted (Req 7.6)
    await expect(page.getByTestId('search-empty-state')).toBeVisible();
    await expect(page.getByTestId('timeline-empty-state')).toBeVisible();

    const axeResults = await new AxeBuilder({ page }).analyze();
    expect(axeResults.violations).toEqual([]);
  });
});
