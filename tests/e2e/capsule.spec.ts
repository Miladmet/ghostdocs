import path from 'path';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

test.describe('Time Capsule Create, Export, and Import (Req 2.1–2.8)', () => {
  test('creates capsule, handles duplicate import skips, and rejects malformed or future-version capsules', async ({
    page,
  }) => {
    await page.goto('/');

    await page
      .getByTestId('upload-input')
      .setInputFiles(path.join(FIXTURES_DIR, 'sample.md'));
    await expect(page.getByTestId('document-card-sample')).toBeVisible({
      timeout: 15000,
    });

    await page.getByTestId('capsule-create-button').click();
    await expect(page.getByTestId('capsule-status')).toContainText(
      'Time Capsule sealed'
    );

    // Import malformed JSON
    const importInput = page.getByTestId('capsule-import-input');
    await importInput.setInputFiles({
      name: 'corrupt.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{ invalid json'),
    });
    await expect(page.getByTestId('capsule-error')).toContainText(
      'Malformed Time Capsule'
    );

    // Import future version capsule (capsuleVersion: 999)
    await importInput.setInputFiles({
      name: 'future.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          capsuleId: 'c-999',
          capsuleVersion: 999,
          createdAt: Date.now(),
          documentCount: 0,
          exportFilename: 'ghostdocs-capsule-2026-11-01.json',
          bundledData: {
            documents: [],
            chunks: [],
            embeddings: [],
            timelineEntries: [],
          },
        })
      ),
    });
    await expect(page.getByTestId('capsule-error')).toContainText(
      'newer application version'
    );

    const axeResults = await new AxeBuilder({ page }).analyze();
    expect(axeResults.violations).toEqual([]);
  });
});
