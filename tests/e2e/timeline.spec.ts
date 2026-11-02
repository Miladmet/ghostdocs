import path from 'path';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

test.describe('Timeline Generation — Historian Agent (Req 5.1–5.10, R-PBT-3)', () => {
  test('renders chronological timeline entries in ascending order and incrementally updates on new upload', async ({
    page,
  }) => {
    await page.goto('/');

    // Empty state before upload
    await expect(page.getByTestId('timeline-empty-state')).toBeVisible();

    // Upload sample.md (contains September 2021 and 14 September 2024)
    await page
      .getByTestId('upload-input')
      .setInputFiles(path.join(FIXTURES_DIR, 'sample.md'));
    await expect(page.getByTestId('document-card-sample')).toBeVisible({
      timeout: 15000,
    });

    const timelineContainer = page.getByTestId('timeline-container');
    await expect(timelineContainer).toBeVisible();

    const entries = timelineContainer.locator('[data-testid="timeline-entry"]');
    await expect(entries.first()).toBeVisible();

    // Verify ascending date ordering (R-PBT-3)
    const dates = await entries.evaluateAll((els) =>
      els
        .map((el) => el.getAttribute('data-resolved-date') || '')
        .filter((d) => d.length > 0)
    );
    const sortedDates = [...dates].sort();
    expect(dates).toEqual(sortedDates);

    // Upload sample.txt (contains implicit temporal signal "In the previous quarter")
    await page
      .getByTestId('upload-input')
      .setInputFiles({
        name: 'second-report.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from(
          'In the previous quarter, revenues fell. During Q3 FY2024 the audit concluded.'
        ),
      });
    await expect(page.getByTestId('document-card-second-report')).toBeVisible({
      timeout: 15000,
    });

    await expect(page.getByTestId('uncertainty-notice').first()).toBeVisible();

    const axeResults = await new AxeBuilder({ page }).analyze();
    expect(axeResults.violations).toEqual([]);
  });
});
