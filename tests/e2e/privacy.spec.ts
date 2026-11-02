import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Privacy & Zero Network Leakage (Req 8.1–8.5, R-PBT-7)', () => {
  test('Property 8 (R-PBT-7): zero outbound network requests carry document canary phrase', async ({
    page,
  }) => {
    const CANARY = 'ghostdocs-canary-secret-phrase-xq7z';
    const leakedUrls: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      const postData = request.postData() ?? '';
      const headers = JSON.stringify(request.headers());

      if (
        url.includes(CANARY) ||
        postData.includes(CANARY) ||
        headers.includes(CANARY)
      ) {
        leakedUrls.push(url);
      }
    });

    await page.goto('/');

    await page.getByTestId('upload-input').setInputFiles({
      name: 'canary-secret.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(
        `Top secret document created on 2023-06-15 containing ${CANARY} inside local IndexedDB.`
      ),
    });

    await expect(page.getByTestId('document-card-canary-secret')).toBeVisible({
      timeout: 15000,
    });

    await page.getByTestId('search-input').fill(CANARY);
    await page.getByTestId('search-submit').click();

    await expect(page.getByTestId('response-block')).toBeVisible({
      timeout: 10000,
    });

    expect(leakedUrls).toHaveLength(0);

    const axeResults = await new AxeBuilder({ page }).analyze();
    expect(axeResults.violations).toEqual([]);
  });
});
