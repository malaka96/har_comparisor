import { expect, test, type Page } from '@playwright/test';
import { App } from './app.ts';

const background = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
const DARK_BG = 'rgb(13, 17, 23)';
const LIGHT_BG = 'rgb(255, 255, 255)';

test.describe('light and dark theme', () => {
  test('follows the system setting by default', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    const app = new App(page);
    await app.open();
    await expect(page.getByLabel('Theme')).toHaveValue('system');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await background(page)).toBe(DARK_BG);

    // The system switching while the page is open is followed too.
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await background(page)).toBe(LIGHT_BG);
  });

  test('a chosen theme applies to the page and the editors, and is remembered', async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme: 'light' });
    const app = new App(page);
    await app.open();
    await app.loadScenario(testInfo);
    await app.pair(0, 0);
    const editorBackground = () =>
      page
        .getByTestId('body-diff')
        .locator('.monaco-editor-background')
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundColor);
    await expect.poll(editorBackground).toBe('rgb(255, 255, 254)');

    await page.getByLabel('Theme').selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await background(page)).toBe(DARK_BG);
    // The open diff editor switches without being reopened.
    await expect.poll(editorBackground).toBe('rgb(30, 30, 30)');

    // The choice survives a reload, even though the HARs and pairs do not (A18).
    await page.reload();
    await expect(page.getByLabel('Theme')).toHaveValue('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(app.counts).toContainText('Pairs: 0');

    await page.getByLabel('Theme').selectOption('system');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});
