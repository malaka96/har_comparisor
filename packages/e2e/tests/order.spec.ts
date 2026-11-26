import { expect, test } from '@playwright/test';
import { entry, har, writeHar } from '../fixtures/har-fixtures.ts';
import { App } from './app.ts';

test.describe('F13: order-only differences', () => {
  test('swapped calls are flagged as out of order', async ({ page }, testInfo) => {
    const app = new App(page);
    await app.open();
    await app.loadScenario(testInfo);
    await app.pairScenario();

    // Legacy 2 and 3 are called the other way round in the new HAR: one of them is flagged.
    await expect(app.counts).toContainText('Out of order: 1');
    await expect(page.getByTestId('entries-legacy').getByTestId('order-flag')).toHaveCount(1);
    await expect(page.getByTestId('entries-new').getByTestId('order-flag')).toHaveCount(1);
    const flagged = page
      .getByTestId('entries-legacy')
      .locator('tr', { has: page.getByTestId('order-flag') });
    await expect(flagged).toHaveAttribute('data-index', /^[23]$/);
  });

  test('an array with the same items in another order is one "order only" change', async ({
    page,
  }, testInfo) => {
    const app = new App(page);
    await app.open();
    const list = (items: unknown[]) =>
      har([
        entry({
          path: '/api/roles',
          response: { mimeType: 'application/json', text: JSON.stringify({ roles: items }) },
        }),
      ]);
    await app.load(
      'legacy',
      writeHar(testInfo.outputPath('legacy.har'), list([{ id: 1 }, { id: 2 }, { id: 3 }])),
    );
    await app.load(
      'new',
      writeHar(testInfo.outputPath('new.har'), list([{ id: 3 }, { id: 1 }, { id: 2 }])),
    );
    await expect(app.rows('new')).toHaveCount(1);

    await app.pair(0, 0);
    await expect(app.verdict).toHaveText('Different');
    await expect(app.tab('Response body')).toContainText('1 change');
    await expect(app.changeRows).toHaveCount(1);
    await expect(app.changeRows.first()).toContainText('$.roles');
    await expect(app.changeRows.first()).toContainText('order only');
    await expect(app.counts).not.toContainText('Out of order');
  });
});
