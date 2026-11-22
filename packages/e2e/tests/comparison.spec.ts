import { expect, test } from '@playwright/test';
import { App } from './app.ts';

test.describe('pairing and comparing', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const app = new App(page);
    await app.open();
    await app.loadScenario(testInfo);
  });

  test('A6, A7, A8: pairs every equivalent request and counts the result', async ({ page }) => {
    const app = new App(page);
    await app.pairScenario();

    await expect(app.counts).toContainText('Pairs: 7');
    await expect(app.counts).toContainText('Identical: 3');
    await expect(app.counts).toContainText('Different: 4');
    await expect(app.counts).toContainText('Missing in new: 1');
    await expect(app.counts).toContainText('Extra in new: 3');

    await expect(app.marker('legacy', 7)).toHaveText('missing');
    for (const index of [7, 8, 9]) await expect(app.marker('new', index)).toHaveText('extra');
    await expect(app.marker('legacy', 1)).toHaveClass(/identical/);
    await expect(app.marker('legacy', 0)).toHaveClass(/different/);
  });

  test('previews two selected requests before they are paired', async ({ page }) => {
    const app = new App(page);
    await app.select(1, 1);
    await expect(app.comparison).toContainText('Not paired yet');
    await expect(app.verdict).toHaveText('Identical');
    await expect(app.pairButton).toBeEnabled();
    await expect(app.unpairButton).toBeDisabled();
  });

  test('A4: unpairs and re-pairs', async ({ page }) => {
    const app = new App(page);
    await app.pair(0, 1); // wrong partner on purpose
    await expect(app.marker('new', 1)).toHaveText(/^#/);

    await app.unpairButton.click();
    await expect(app.marker('legacy', 0)).toHaveText('missing');
    await expect(app.marker('new', 1)).toHaveText('extra');

    await app.pair(0, 1);
    await app.pair(0, 0); // re-pair: legacy 0 moves to new 0, new 1 is released
    await expect(app.marker('new', 0)).toHaveText(/^#/);
    await expect(app.marker('new', 1)).toHaveText('extra');
    await expect(app.counts).toContainText('Pairs: 1');
  });

  test('clicking a paired request selects its partner', async ({ page }) => {
    const app = new App(page);
    await app.pairScenario();
    await app.row('legacy', 2).click();
    await expect(app.row('new', 3)).toHaveClass(/selected/);
    await app.row('new', 2).click();
    await expect(app.row('legacy', 3)).toHaveClass(/selected/);
  });

  test('A14: identical pairs are marked and show no changes', async ({ page }) => {
    const app = new App(page);
    await app.pair(1, 1);
    await expect(app.verdict).toHaveText('Identical');
    await expect(app.marker('legacy', 1)).toHaveClass(/identical/);
    await expect(app.tab('Response body')).toContainText('same');
    await expect(page.getByTestId('change-list')).toContainText('The bodies are the same');
  });

  test('A9, A13: status and request payload differences', async ({ page }) => {
    const app = new App(page);
    await app.pair(2, 3);

    await expect(app.verdict).toHaveText('Different');
    await expect(app.summaryRow('Status')).toHaveClass(/differs/);
    await expect(app.summaryRow('Status')).toContainText('500');
    await expect(app.summaryRow('Status')).toContainText('200');
    await expect(app.summaryRow('Method')).not.toHaveClass(/differs/);

    await app.tab('Request body').click();
    await expect(app.tab('Request body')).toContainText('1 change');
    await expect(app.changeRows).toHaveCount(1);
    await expect(app.changeRows.first()).toContainText('$.qty');
    await expect(app.changeRows.first()).toContainText('type');
  });

  test('A12, F8: JSON response differences are listed and highlighted side by side', async ({
    page,
  }) => {
    const app = new App(page);
    await app.pair(2, 3);

    await expect(app.tab('Response body')).toContainText('3 changes');
    await expect(app.changeRows).toHaveCount(3);
    await expect(page.getByTestId('change-list')).toContainText('$.error');
    await expect(page.getByTestId('change-list')).toContainText('$.id');

    const diff = page.getByTestId('body-diff');
    await expect(diff.locator('.editor.original')).toHaveCount(1);
    await expect(diff.locator('.editor.modified')).toHaveCount(1);
    await expect(diff.locator('.line-delete, .char-delete').first()).toBeVisible();
    await expect(diff.locator('.line-insert, .char-insert').first()).toBeVisible();
  });

  test('A12: a single changed value is reported with its path', async ({ page }) => {
    const app = new App(page);
    await app.pair(0, 0);
    await expect(app.changeRows).toHaveCount(1);
    await expect(app.changeRows.first()).toContainText('$.users[0].name');
    await expect(app.changeRows.first()).toContainText('"Ann"');
    await expect(app.changeRows.first()).toContainText('"Bob"');
  });

  test('A10: URL path differences are highlighted', async ({ page }) => {
    const app = new App(page);
    await app.pair(3, 2);
    await expect(app.summaryRow('Path')).toHaveClass(/differs/);
    await expect(app.summaryRow('Path')).toContainText('/api/search/hom');
    await expect(app.summaryRow('Path')).toContainText('/api/search/homa');
    await expect(app.tab('Response body')).toContainText('same');
  });

  test('A15: requests without a body (204) compare without errors', async ({ page }) => {
    const app = new App(page);
    await app.pair(5, 5);
    await expect(app.verdict).toHaveText('Identical');
    await expect(app.tab('Response body')).toContainText('same');
    await expect(app.tab('Request body')).toContainText('same');
  });

  test('Base64 bodies compare without being decoded', async ({ page }) => {
    const app = new App(page);
    await app.pair(4, 4);
    await expect(app.verdict).toHaveText('Identical');
    await expect(page.getByTestId('change-list')).toContainText('Binary content is the same');
  });

  test('text bodies are compared line by line', async ({ page }) => {
    const app = new App(page);
    await app.pair(6, 6);
    await expect(app.verdict).toHaveText('Different');
    await expect(app.tab('Response body')).toContainText('differs');
    await expect(
      page.getByTestId('body-diff').locator('.line-insert, .char-insert').first(),
    ).toBeVisible();
  });

  test('JSON key order alone is not a difference', async ({ page }) => {
    const app = new App(page);
    await app.pair(1, 1);
    await expect(app.verdict).toHaveText('Identical');
  });

  test('A16: panels can be resized by dragging', async ({ page }) => {
    const app = new App(page);
    await app.pair(1, 1);

    const pane = page.getByTestId('pane-legacy');
    const before = (await pane.boundingBox())!.width;
    const handle = (await page.locator('.separator.vertical').first().boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + 100);
    await page.mouse.down();
    await page.mouse.move(handle.x + 300, handle.y + 100, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await pane.boundingBox())!.width).toBeGreaterThan(before + 200);

    const detail = app.comparison;
    const heightBefore = (await detail.boundingBox())!.height;
    const bar = (await page.locator('.separator.horizontal').first().boundingBox())!;
    await page.mouse.move(bar.x + 200, bar.y + bar.height / 2);
    await page.mouse.down();
    await page.mouse.move(bar.x + 200, bar.y - 150, { steps: 8 });
    await page.mouse.up();
    await expect
      .poll(async () => (await detail.boundingBox())!.height)
      .toBeGreaterThan(heightBefore + 100);
  });

  test('loading another file clears the pairs', async ({ page }, testInfo) => {
    const app = new App(page);
    await app.pair(1, 1);
    await expect(app.counts).toContainText('Pairs: 1');
    await app.loadScenario(testInfo);
    await expect(app.counts).toContainText('Pairs: 0');
  });
});
