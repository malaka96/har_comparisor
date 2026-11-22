import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { legacyScenario, writeHar } from '../fixtures/har-fixtures.ts';
import { App } from './app.ts';

test.describe('loading HAR files', () => {
  test('A1, A18: loads a HAR and lists its requests', async ({ page }, testInfo) => {
    const app = new App(page);
    await app.open();
    await app.load('legacy', writeHar(testInfo.outputPath('legacy.har'), legacyScenario()));

    await expect(app.rows('legacy')).toHaveCount(8);
    await expect(page.getByTestId('info-legacy')).toContainText('legacy.har');
    await expect(page.getByTestId('info-legacy')).toContainText('8 requests');
    const first = app.row('legacy', 0);
    await expect(first).toContainText('GET');
    await expect(first).toContainText('/api/users');
    await expect(first).toContainText('200');
    await expect(app.row('legacy', 2)).toContainText('500');
  });

  test('previews the body of a single request', async ({ page }, testInfo) => {
    const app = new App(page);
    await app.open();
    await app.load('legacy', writeHar(testInfo.outputPath('legacy.har'), legacyScenario()));
    await app.row('legacy', 0).click();

    const preview = page.getByTestId('entry-preview');
    await expect(preview).toContainText('Legacy');
    await expect(preview.locator('.monaco-editor .view-lines')).toContainText('"Ann"');
  });

  test('A2: rejects bad files with a clear message and keeps the loaded HAR', async ({
    page,
  }, testInfo) => {
    const app = new App(page);
    await app.open();
    await app.load('legacy', writeHar(testInfo.outputPath('legacy.har'), legacyScenario()));
    await expect(app.rows('legacy')).toHaveCount(8);

    const cases: Array<[string, string, string]> = [
      ['not-json.har', 'hello', 'not valid JSON'],
      ['not-har.json', '{"a":1}', 'not a HAR'],
      ['empty.har', '', 'empty'],
    ];
    for (const [name, content, message] of cases) {
      const file = testInfo.outputPath(name);
      writeFileSync(file, content);
      await app.load('legacy', file);
      await expect(page.getByTestId('error-legacy')).toContainText(name);
      await expect(page.getByTestId('error-legacy')).toContainText(message);
      await expect(app.rows('legacy')).toHaveCount(8);
    }
  });

  test('A7, A8: before pairing, every request is missing or extra', async ({ page }, testInfo) => {
    const app = new App(page);
    await app.open();
    await app.loadScenario(testInfo);

    await expect(app.counts).toContainText('Pairs: 0');
    await expect(app.counts).toContainText('Missing in new: 8');
    await expect(app.counts).toContainText('Extra in new: 10');
    await expect(app.marker('legacy', 0)).toHaveText('missing');
    await expect(app.marker('new', 0)).toHaveText('extra');
  });

  test('reloading the page resets everything', async ({ page }, testInfo) => {
    const app = new App(page);
    await app.open();
    await app.loadScenario(testInfo);
    await app.pair(1, 1);

    await page.reload();
    await expect(page.getByTestId('pane-legacy')).toContainText('Choose a HAR file');
    await expect(app.counts).toContainText('Pairs: 0');
  });
});
