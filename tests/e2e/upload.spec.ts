import path from 'path';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

test.describe('Document Upload and Ingestion (Req 1.1–1.12)', () => {
  test('happy path: uploads sample.md, shows document card and Archivist metadata, and passes axe-core', async ({
    page,
  }) => {
    await page.goto('/');

    const uploadInput = page.getByTestId('upload-input');
    await uploadInput.setInputFiles(path.join(FIXTURES_DIR, 'sample.md'));

    const docCard = page.getByTestId('document-card-sample');
    await expect(docCard).toBeVisible({ timeout: 15000 });
    await expect(docCard).toContainText('sample.md');

    const archivistPanel = page.getByTestId('agent-archivist');
    await expect(archivistPanel).toContainText('Evelyn Cross');

    const axeResults = await new AxeBuilder({ page }).analyze();
    expect(axeResults.violations).toEqual([]);
  });

  test('error handling: rejects unsupported file format (.docx) with inline upload-error', async ({
    page,
  }) => {
    await page.goto('/');

    const uploadInput = page.getByTestId('upload-input');
    await uploadInput.setInputFiles({
      name: 'unsupported.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.from('invalid docx payload'),
    });

    const uploadError = page.getByTestId('upload-error');
    await expect(uploadError).toBeVisible();
    await expect(uploadError).toContainText('unsupported.docx');
  });

  test('duplicate detection: uploading the same file twice triggers duplicate-confirm dialog', async ({
    page,
  }) => {
    await page.goto('/');

    const uploadInput = page.getByTestId('upload-input');
    await uploadInput.setInputFiles(path.join(FIXTURES_DIR, 'sample.txt'));
    await expect(page.getByTestId('document-card-sample')).toBeVisible({
      timeout: 15000,
    });

    // Upload the same filename again
    await uploadInput.setInputFiles(path.join(FIXTURES_DIR, 'sample.txt'));
    const duplicateDialog = page.getByTestId('duplicate-confirm');
    await expect(duplicateDialog).toBeVisible();

    await page.getByTestId('duplicate-cancel-button').click();
    await expect(duplicateDialog).toBeHidden();
  });
});
