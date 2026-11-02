# GhostDocs — Testing Standards Steering

## Testing Philosophy

GhostDocs has no backend, so unit tests cover pure logic and Playwright E2E tests cover everything the user actually experiences. The acceptance bar is: **if a Playwright test can exercise it, write a Playwright test for it.**

---

## Playwright E2E Testing

### Setup

- Framework: [Playwright](https://playwright.dev/) (`@playwright/test`).
- Config file: `playwright.config.ts` at the project root.
- Test directory: `tests/e2e/`.
- Run tests against the static export served locally (`npx serve out` or `npx playwright test` with `webServer` config pointing to `npx serve out -p 3000`).
- CI must run `npx playwright test --reporter=html` and upload the HTML report as an artefact.

### Test File Naming

- One test file per major feature or user flow: `tests/e2e/upload.spec.ts`, `tests/e2e/search.spec.ts`, `tests/e2e/timeline.spec.ts`, etc.
- Shared fixtures and helpers: `tests/e2e/fixtures/`.

### Mandatory `data-testid` Attributes

**Every interactive UI element must have a `data-testid` attribute.** This is a hard requirement — PRs that add interactive elements without `data-testid` must not be merged.

Rules for `data-testid` values:
- Use kebab-case: `data-testid="upload-button"`, `data-testid="search-input"`.
- Be descriptive and scoped: prefer `agent-archivist-card` over `card-1`.
- For repeated elements (e.g. document list items), include a stable identifier: `data-testid="document-item-{slug}"`.
- Never use dynamic indices as the sole differentiator (`document-item-0` is fragile — use the document slug or id).

Required `data-testid` coverage (minimum):

| Element | `data-testid` |
|---|---|
| File upload input | `upload-input` |
| Upload trigger button | `upload-button` |
| Search text input | `search-input` |
| Search submit button | `search-submit` |
| Each document card | `document-card-{slug}` |
| Archivist agent panel | `agent-archivist` |
| Historian agent panel | `agent-historian` |
| Researcher agent panel | `agent-researcher` |
| Citation link/badge | `citation-{chunkId}` |
| Timeline container | `timeline-container` |
| Answer/response block | `response-block` |
| Uncertainty notice | `uncertainty-notice` |
| Clear/delete document button | `delete-document-{slug}` |

Add more as new features are built — this table is a minimum floor, not a ceiling.

### Selector Strategy

Prefer `data-testid` selectors in all Playwright tests:

```typescript
// ✅ Good
await page.getByTestId('upload-button').click();
await page.getByTestId('search-input').fill('Q3 budget');

// ❌ Avoid — brittle to style/content changes
await page.locator('.btn-primary').click();
await page.locator('button:has-text("Upload")').click();
```

Use `getByRole` as a secondary option for elements where ARIA role is the most stable identifier (e.g. dialog, alertdialog).

### Acceptance Test Patterns

Each Playwright spec must include:

1. **Happy path** — the primary success flow works end-to-end.
2. **Error/edge case** — at least one invalid input or failure mode is handled gracefully.
3. **Accessibility check** — run `@axe-core/playwright` on the page after each major state change and assert zero violations.

```typescript
import AxeBuilder from '@axe-core/playwright';

test('upload page has no accessibility violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

### Web Worker & IndexedDB Considerations

- Tests run against the built static export, so Web Workers and IndexedDB work as they would for real users.
- Use Playwright's `page.waitForFunction` to poll IndexedDB state if needed, or expose a `window.__ghostdocs_testApi` object in non-production builds for test hooks.
- Never mock IndexedDB in E2E tests — test against the real implementation.

---

## Unit & Integration Tests

- Framework: [Vitest](https://vitest.dev/) for pure logic (chunker, cosine similarity, date parsing utilities).
- Test directory: `tests/unit/`.
- Run with `npx vitest run` (single pass, no watch mode in CI).
- Coverage threshold: 80% line coverage for files in `lib/`.
- Do not unit-test React components — use Playwright for component behaviour.

---

## CI Requirements

Every pull request must pass:

1. `tsc --noEmit` — zero TypeScript errors.
2. `npx vitest run` — all unit tests pass, coverage threshold met.
3. `npx playwright test` — all E2E tests pass on Chromium (minimum); Firefox and WebKit are optional but recommended.
4. `next build` — static export builds without errors or warnings.

---

## Test Data

- Sample documents for testing live in `tests/fixtures/`: a short PDF (`sample.pdf`), a Markdown file (`sample.md`), and a plain-text file (`sample.txt`).
- These files contain synthetic, non-sensitive content purpose-built for testing citation, search, and timeline features.
- Do not commit real organisational documents to the repository.
