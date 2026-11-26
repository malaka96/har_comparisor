import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { entry, har, legacyScenario, writeHar } from '../fixtures/har-fixtures.ts';
import { App } from './app.ts';

test.describe('F15: save and load a session', () => {
  test('pairs and filters come back after a reload', async ({ page }, testInfo) => {
    const app = new App(page);
    await app.open();
    const session = page.getByTestId('session');
    await expect(session.getByRole('button', { name: 'Save session' })).toBeDisabled();
    await app.loadScenario(testInfo);
    await app.pair(0, 0);
    await app.pair(2, 3);
    await page.getByLabel('Status').selectOption('5xx');

    const downloaded = page.waitForEvent('download');
    await session.getByRole('button', { name: 'Save session' }).click();
    const download = await downloaded;
    expect(download.suggestedFilename()).toBe('har-session_legacy_vs_new.json');
    const file = testInfo.outputPath('session.json');
    await download.saveAs(file);
    const saved = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    expect(saved['pairs']).toEqual([
      { legacy: 0, new: 0 },
      { legacy: 2, new: 3 },
    ]);
    // The session holds no HAR content, only names, counts, indexes and the filter.
    expect(JSON.stringify(saved)).not.toContain('/api/');

    // A reload resets everything (A18); loading the session brings the work back.
    await page.reload();
    await app.loadScenario(testInfo);
    await expect(app.counts).toContainText('Pairs: 0');
    await page.getByTestId('file-session').setInputFiles(file);
    await expect(page.getByTestId('session-notice')).toHaveText(/2 pairs restored/);
    await expect(app.counts).toContainText('Pairs: 2');
    await expect(page.getByLabel('Status')).toHaveValue('5xx');
    await expect(app.rows('legacy')).toHaveCount(1);
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(app.marker('legacy', 2)).toHaveText('#2');
    await expect(app.marker('new', 3)).toHaveText('#2');
  });

  test('warns when the HARs differ and rejects files that are not sessions', async ({
    page,
  }, testInfo) => {
    const app = new App(page);
    await app.open();
    await app.load('legacy', writeHar(testInfo.outputPath('legacy.har'), legacyScenario()));
    await app.load(
      'new',
      writeHar(testInfo.outputPath('other.har'), har([entry({ path: '/api/only' })])),
    );
    await expect(app.rows('new')).toHaveCount(1);

    const session = testInfo.outputPath('session.json');
    writeFileSync(
      session,
      JSON.stringify({
        kind: 'har-comparisor-session',
        version: 1,
        savedAt: '2026-01-01T00:00:00.000Z',
        legacy: { fileName: 'legacy.har', requests: 8 },
        new: { fileName: 'new.har', requests: 10 },
        pairs: [
          { legacy: 0, new: 0 },
          { legacy: 1, new: 5 },
        ],
        filter: {},
      }),
    );
    await page.getByTestId('file-session').setInputFiles(session);
    const notice = page.getByTestId('session-notice');
    await expect(notice).toContainText('1 pair restored');
    await expect(notice).toContainText('The new HAR is other.har');
    await expect(notice).toContainText('1 saved pair did not fit');
    await expect(app.counts).toContainText('Pairs: 1');

    const notASession = writeHar(testInfo.outputPath('not-a-session.json'), har([]));
    await page.getByTestId('file-session').setInputFiles(notASession);
    await expect(notice).toHaveAttribute('role', 'alert');
    await expect(notice).toContainText('not a HAR Comparisor session file');
    // A failed load keeps the current pairs.
    await expect(app.counts).toContainText('Pairs: 1');
  });
});
