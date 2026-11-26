import { expect, test } from '@playwright/test';
import { App } from './app.ts';

test.describe('F10: filtering and search', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const app = new App(page);
    await app.open();
    await app.loadScenario(testInfo);
  });

  test('text search filters both lists by URL', async ({ page }) => {
    const app = new App(page);
    await page.getByLabel('Search URLs').fill('ORDERS');
    await expect(app.rows('legacy')).toHaveCount(1);
    await expect(app.rows('new')).toHaveCount(1);
    await expect(app.row('legacy', 2)).toBeVisible();
    await expect(page.getByTestId('shown-legacy')).toHaveText('showing 1');
    // The total stays visible next to the filtered count.
    await expect(page.getByTestId('info-legacy')).toContainText('8 requests');
  });

  test('method, status and type filters', async ({ page }) => {
    const app = new App(page);
    await page.getByLabel('Method').selectOption('DELETE');
    await expect(app.rows('legacy')).toHaveCount(1);
    await expect(app.row('legacy', 5)).toBeVisible();

    await page.getByLabel('Method').selectOption('all');
    await page.getByLabel('Status').selectOption('5xx');
    await expect(app.rows('legacy')).toHaveCount(1);
    await expect(page.getByTestId('no-match-new')).toBeVisible();

    await page.getByLabel('Status').selectOption('failed');
    await expect(app.rows('new')).toHaveCount(1);
    await expect(app.row('new', 9)).toBeVisible();

    await page.getByLabel('Status').selectOption('3xx');
    await expect(app.row('new', 8)).toBeVisible();

    await page.getByLabel('Status').selectOption('all');
    await page.getByLabel('Type').selectOption('image');
    await expect(app.rows('legacy')).toHaveCount(1);
    await expect(app.row('legacy', 4)).toBeVisible();

    await page.getByLabel('Type').selectOption('api');
    await expect(app.rows('legacy')).toHaveCount(7);
  });

  test('pair filter and clearing the filters', async ({ page }) => {
    const app = new App(page);
    await app.pair(1, 1);
    await app.pair(0, 0);
    await expect(page.locator('.marker.pending')).toHaveCount(0);

    await page.getByLabel('Pair').selectOption('identical');
    await expect(app.rows('legacy')).toHaveCount(1);
    await expect(app.row('legacy', 1)).toBeVisible();

    await page.getByLabel('Pair').selectOption('different');
    await expect(app.rows('legacy')).toHaveCount(1);
    await expect(app.row('legacy', 0)).toBeVisible();

    await page.getByLabel('Pair').selectOption('unpaired');
    await expect(app.rows('legacy')).toHaveCount(6);
    await expect(app.rows('new')).toHaveCount(8);

    // Filtering does not change the pairs or the counts.
    await expect(app.counts).toContainText('Pairs: 2');

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(app.rows('legacy')).toHaveCount(8);
    await expect(app.rows('new')).toHaveCount(10);
    await expect(page.getByTestId('shown-legacy')).toHaveCount(0);
  });
});
