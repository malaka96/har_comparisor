import { expect, test } from '@playwright/test';
import { entry, har, writeHar } from '../fixtures/har-fixtures.ts';
import { App } from './app.ts';

const body = { mimeType: 'application/json', text: '{"ok":true}' };

test.describe('F5: header comparison', () => {
  test('differing headers are counted apart from the verdict and shown side by side', async ({
    page,
  }, testInfo) => {
    const app = new App(page);
    await app.open();
    await app.load(
      'legacy',
      writeHar(
        testInfo.outputPath('legacy.har'),
        har([
          entry({
            path: '/api/profile',
            response: body,
            requestHeaders: [{ name: 'X-Client', value: 'legacy-app' }],
            responseHeaders: [{ name: 'Cache-Control', value: 'no-cache' }],
          }),
        ]),
      ),
    );
    await app.load(
      'new',
      writeHar(
        testInfo.outputPath('new.har'),
        har([
          entry({
            path: '/api/profile',
            response: body,
            requestHeaders: [{ name: 'X-Client', value: 'new-app' }],
            responseHeaders: [
              { name: 'Cache-Control', value: 'no-store' },
              { name: 'Strict-Transport-Security', value: 'max-age=31536000' },
            ],
          }),
        ]),
      ),
    );
    await expect(app.rows('legacy')).toHaveCount(1);
    await expect(app.rows('new')).toHaveCount(1);

    await app.pair(0, 0);
    // URL, status and bodies match, so the pair is identical; the headers are reported apart.
    await expect(app.verdict).toHaveText('Identical');
    await expect(page.getByTestId('header-note')).toHaveText('Headers differ');
    await expect(app.counts).toContainText('Identical: 1');
    await expect(app.counts).toContainText('Header differences: 1');
    await expect(app.row('legacy', 0).getByTestId('header-flag')).toBeVisible();
    await expect(app.tab('Response body')).toContainText('same');
    await expect(app.tab('Response headers')).toContainText('2 changes');
    await expect(app.tab('Request headers')).toContainText('1 change');

    await app.tab('Response headers').click();
    const table = page.getByTestId('header-table');
    await expect(table.locator('tr[data-header="cache-control"]')).toHaveClass(/changed/);
    await expect(table.locator('tr[data-header="cache-control"]')).toContainText('no-cache');
    await expect(table.locator('tr[data-header="cache-control"]')).toContainText('no-store');
    await expect(table.locator('tr[data-header="strict-transport-security"]')).toContainText(
      'only in new',
    );
    await expect(table.locator('tr[data-header="content-type"]')).toHaveClass(/same/);

    await app.tab('Request headers').click();
    await expect(table.locator('tr[data-header="x-client"]')).toContainText('legacy-app');
    await expect(table.locator('tr[data-header="x-client"]')).toContainText('new-app');
  });

  test('headers that change on every request are shown but ignored', async ({ page }, testInfo) => {
    const app = new App(page);
    await app.open();
    const withHeaders = (date: string, requestId: string) =>
      har([
        entry({
          path: '/api/profile',
          response: body,
          responseHeaders: [
            { name: 'Date', value: date },
            { name: 'X-Request-Id', value: requestId },
          ],
        }),
      ]);
    await app.load(
      'legacy',
      writeHar(
        testInfo.outputPath('legacy.har'),
        withHeaders('Mon, 01 Jan 2026 10:00:00 GMT', 'aaa'),
      ),
    );
    await app.load(
      'new',
      writeHar(testInfo.outputPath('new.har'), withHeaders('Tue, 02 Jan 2026 11:00:00 GMT', 'bbb')),
    );
    await expect(app.rows('new')).toHaveCount(1);

    await app.pair(0, 0);
    await expect(app.verdict).toHaveText('Identical');
    await expect(page.getByTestId('header-note')).toHaveCount(0);
    await expect(app.counts).toContainText('Header differences: 0');
    await expect(app.tab('Response headers')).toContainText('same');
    await app.tab('Response headers').click();
    const table = page.getByTestId('header-table');
    await expect(table).toContainText('ignored by default');
    await expect(table.locator('tr[data-header="date"]')).toHaveClass(/ignored/);
    await expect(table.locator('tr[data-header="date"]')).toContainText('ignored');
  });
});
