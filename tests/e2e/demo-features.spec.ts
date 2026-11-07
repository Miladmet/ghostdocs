import { test as base, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Demo features: "Load Sample Vault" button and query suggestion pills.
 * Each test gets a fresh browser context, so IndexedDB starts empty.
 * Page errors and console errors are collected and fail the test.
 */
const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });
    await use(errors);
    expect(errors, 'no page or console errors').toEqual([]);
  },
});

const Q3_QUERY = 'What was the Q3 budget allocation?';

async function loadVault(page: Page) {
  await page.getByTestId('load-sample-vault-button').click();
  await expect(page.getByTestId('document-card-sample')).toBeVisible({ timeout: 25000 });
  await expect(page.getByTestId('document-card-q3-audit')).toBeVisible({ timeout: 25000 });
}

test.describe('Sample vault and query suggestions', () => {
  test('sample vault happy path: both cards, Archivist metadata, axe clean', async ({
    page,
    errors,
  }) => {
    void errors;
    await page.goto('/');
    await loadVault(page);

    const archivist = page.getByTestId('agent-archivist');
    await expect(archivist).toContainText('Evelyn Cross');
    await expect(archivist).toContainText('Marcus Sterling');

    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations).toEqual([]);
  });

  test('sample vault edge case: second click prompts duplicate-confirm and cancel keeps 2 cards', async ({
    page,
    errors,
  }) => {
    void errors;
    await page.goto('/');
    await loadVault(page);

    await page.getByTestId('load-sample-vault-button').click();
    const dialog = page.getByTestId('duplicate-confirm');
    await expect(dialog).toBeVisible();
    await page.getByTestId('duplicate-cancel-button').click();
    await expect(dialog).toBeHidden();

    const cards = page.locator('[data-testid^="document-card-"]');
    await expect(cards).toHaveCount(2);
    await expect(page.getByTestId('document-card-sample')).toHaveCount(1);
    await expect(page.getByTestId('document-card-q3-audit')).toHaveCount(1);
  });

  test('Q3 budget pill fills input, answers with citations and both budgets, shows uncertainty, axe clean', async ({
    page,
    errors,
  }) => {
    void errors;
    await page.goto('/');
    await loadVault(page);

    await page.getByTestId('query-suggestion-q3-budget').click();
    await expect(page.getByTestId('search-input')).toHaveValue(Q3_QUERY);

    const response = page.getByTestId('response-block');
    await expect(response).toBeVisible({ timeout: 15000 });
    await expect(response.locator('[data-testid^="citation-"]').first()).toBeVisible();
    await expect(response).toContainText('450,000');
    await expect(response).toContainText('310,000');
    await expect(response.getByTestId('uncertainty-notice')).toBeVisible();

    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations).toEqual([]);
  });

  test('security constitution pill answers with the ratification date', async ({
    page,
    errors,
  }) => {
    void errors;
    await page.goto('/');
    await loadVault(page);

    await page.getByTestId('query-suggestion-security-constitution').click();
    await expect(page.getByTestId('response-block')).toContainText('14 September 2024', {
      timeout: 15000,
    });
  });

  test('pill with empty store fills input but produces no answer and no crash', async ({
    page,
    errors,
  }) => {
    void errors;
    await page.goto('/');

    await page.getByTestId('query-suggestion-q3-budget').click();
    await expect(page.getByTestId('search-input')).toHaveValue(Q3_QUERY);
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('response-block')).toHaveCount(0);
    await expect(page.getByTestId('search-input')).toBeVisible();
  });

  test('keyboard: Enter on the vault button and on a pill', async ({ page, errors }) => {
    void errors;
    await page.goto('/');

    const vaultButton = page.getByTestId('load-sample-vault-button');
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      if (await vaultButton.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(vaultButton).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('document-card-sample')).toBeVisible({ timeout: 25000 });
    await expect(page.getByTestId('document-card-q3-audit')).toBeVisible({ timeout: 25000 });

    const pill = page.getByTestId('query-suggestion-q3-budget');
    // Reach the pill via Tab from the search input to prove it is keyboard reachable.
    await page.getByTestId('search-input').focus();
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      if (await pill.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(pill).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('response-block')).toBeVisible({ timeout: 15000 });
  });
});
