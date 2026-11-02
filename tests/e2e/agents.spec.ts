import path from 'path';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

test.describe('AI Crew Agent Panels (Req 4.1–4.10, 6.1–6.7)', () => {
  test('renders Archivist, Historian, and Researcher panels with source-cited answers and error handling', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.getByTestId('agent-archivist')).toBeVisible();
    await expect(page.getByTestId('agent-historian')).toBeVisible();
    await expect(page.getByTestId('agent-researcher')).toBeVisible();

    await page
      .getByTestId('upload-input')
      .setInputFiles(path.join(FIXTURES_DIR, 'sample.md'));
    await expect(page.getByTestId('document-card-sample')).toBeVisible({
      timeout: 15000,
    });

    // Submit a question to Researcher
    await page.getByTestId('search-input').fill('What happened on 14 September 2024?');
    await page.getByTestId('search-submit').click();

    const responseBlock = page.getByTestId('response-block');
    await expect(responseBlock).toBeVisible({ timeout: 10000 });
    await expect(
      responseBlock.locator('[data-testid^="citation-"]').first()
    ).toBeVisible();

    // Simulate Researcher timeout error state (Req 6.5, 6.7)
    await page.getByTestId('search-input').fill('__FORCE_WORKER_TIMEOUT__');
    await page.getByTestId('search-submit').click();

    await expect(page.getByTestId('agent-researcher-error')).toBeVisible();

    const axeResults = await new AxeBuilder({ page }).analyze();
    expect(axeResults.violations).toEqual([]);
  });
});
