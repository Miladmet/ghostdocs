import { test, expect } from '@playwright/test';
import path from 'path';

test.use({
  video: {
    mode: 'on',
    size: { width: 1280, height: 720 },
  },
  viewport: { width: 1280, height: 720 },
});

test('record full ghostdocs video walkthrough', async ({ page }) => {
  test.setTimeout(180_000);

  // 1. Visit GhostDocs homepage
  await page.goto('/');
  await page.waitForTimeout(3000);

  // 2. Upload sample.md
  const fixturesDir = path.resolve(__dirname, '../fixtures');
  const uploadInput = page.getByTestId('upload-input');
  await uploadInput.setInputFiles(path.join(fixturesDir, 'sample.md'));

  // Wait for document card to appear
  await expect(page.getByTestId('document-card-sample')).toBeVisible({ timeout: 25_000 });
  await page.waitForTimeout(3000);

  // 3. Upload q3-audit.txt
  await uploadInput.setInputFiles(path.join(fixturesDir, 'q3-audit.txt'));
  await expect(page.getByTestId('document-card-q3-audit')).toBeVisible({ timeout: 25_000 });
  await page.waitForTimeout(3000);

  // 4. Scroll to The Archivist panel
  const archivistPanel = page.getByTestId('agent-archivist');
  await archivistPanel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(4000);

  // 5. Scroll to The Historian timeline
  const historianPanel = page.getByTestId('agent-historian');
  await historianPanel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(5000);

  // 6. Scroll up to Search Bar
  const searchInput = page.getByTestId('search-input');
  await searchInput.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2000);

  // 7. Query: "What was the Q3 budget allocation?"
  await searchInput.focus();
  await page.waitForTimeout(800);
  await searchInput.pressSequentially('What was the Q3 budget allocation?', { delay: 50 });
  await page.waitForTimeout(1000);
  await page.getByTestId('search-submit').click();

  // Wait for response block
  const responseBlock = page.getByTestId('response-block');
  await expect(responseBlock).toBeVisible({ timeout: 30_000 });
  await responseBlock.scrollIntoViewIfNeeded();
  await page.waitForTimeout(6000);

  // Hover over citation badge
  const citationBadge = page.locator('[data-testid^="citation-"]').first();
  if (await citationBadge.isVisible()) {
    await citationBadge.hover();
    await page.waitForTimeout(3000);
  }

  // 8. Query 2: "When was the security constitution ratified?"
  await searchInput.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await searchInput.fill('');
  await searchInput.pressSequentially('When was the security constitution ratified?', { delay: 45 });
  await page.waitForTimeout(1000);
  await page.getByTestId('search-submit').click();

  await page.waitForTimeout(4000);
  await responseBlock.scrollIntoViewIfNeeded();
  await page.waitForTimeout(5000);

  // 9. Time Capsule Controls
  const createCapsuleBtn = page.getByTestId('capsule-create-button');
  await createCapsuleBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2000);
  await createCapsuleBtn.click();
  await page.waitForTimeout(3000);

  // Export capsule
  const exportCapsuleBtn = page.getByTestId('capsule-export-button');
  await exportCapsuleBtn.click();
  await page.waitForTimeout(3000);

  // 10. Smooth scroll back to top
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(4000);
});
