import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { entry, har, writeHar } from '../fixtures/har-fixtures.ts';
import { App } from './app.ts';

async function exportReport(page: Page, format: string) {
  await page.getByLabel('Report format').selectOption({ label: format });
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export report' }).click();
  const download = await downloaded;
  const path = await download.path();
  return { fileName: download.suggestedFilename(), content: readFileSync(path, 'utf8') };
}

test.describe('F12: reports', () => {
  test('the JSON report matches the summary bar', async ({ page }, testInfo) => {
    const app = new App(page);
    await app.open();
    await expect(page.getByRole('button', { name: 'Export report' })).toBeDisabled();
    await app.loadScenario(testInfo);
    await app.pairScenario();
    await expect(app.counts).toContainText('Identical: 3');

    const { fileName, content } = await exportReport(page, 'JSON');
    expect(fileName).toBe('har-report_legacy_vs_new.json');
    const report = JSON.parse(content) as {
      summary: Record<string, number>;
      pairs: Array<{ number: number; verdict: string; outOfOrder: boolean }>;
    };
    expect(report.summary).toEqual({
      pairs: 7,
      identical: 3,
      different: 4,
      headerDifferences: 0,
      outOfOrder: 1,
      missing: 1,
      extra: 3,
    });
    expect(report.pairs.map((p) => p.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(report.pairs.filter((p) => p.outOfOrder)).toHaveLength(1);
  });

  test('the HTML and text reports list pairs, missing and extra requests', async ({
    page,
  }, testInfo) => {
    const app = new App(page);
    await app.open();
    await app.loadScenario(testInfo);
    await app.pair(0, 0);

    const html = await exportReport(page, 'HTML');
    expect(html.fileName).toMatch(/\.html$/);
    expect(html.content).toMatch(/^<!doctype html>/);
    expect(html.content).not.toContain('<script');
    expect(html.content).toContain('/api/legacy-only');

    const text = await exportReport(page, 'Text');
    expect(text.fileName).toMatch(/\.txt$/);
    expect(text.content).toContain('#1 DIFFERENT');
    expect(text.content).toContain('response body $.users[0].name [value]: "Ann" -> "Bob"');
    expect(text.content).toContain('/api/new-only');
  });

  test('secrets are redacted by default and kept when redaction is off', async ({
    page,
  }, testInfo) => {
    const app = new App(page);
    await app.open();
    const side = (secret: string) =>
      har([
        entry({
          path: '/api/me',
          query: { access_token: `${secret}-query` },
          requestHeaders: [{ name: 'Authorization', value: `Bearer ${secret}-header` }],
          response: {
            mimeType: 'application/json',
            text: JSON.stringify({ name: secret, sessionId: `${secret}-body` }),
          },
        }),
      ]);
    await app.load('legacy', writeHar(testInfo.outputPath('legacy.har'), side('alpha')));
    await app.load('new', writeHar(testInfo.outputPath('new.har'), side('omega')));
    await expect(app.rows('new')).toHaveCount(1);
    await app.pair(0, 0);

    const redacted = await exportReport(page, 'Text');
    for (const secret of ['-query', '-header', '-body']) {
      expect(redacted.content).not.toContain(secret);
    }
    expect(redacted.content).toContain('[redacted]');
    // A field that is not a secret stays readable.
    expect(redacted.content).toContain('"alpha" -> "omega"');

    await page.getByLabel('Redact secrets').uncheck();
    const plain = await exportReport(page, 'Text');
    expect(plain.content).toContain('Bearer alpha-header');
    expect(plain.content).toContain('alpha-body');
  });

  test('PDF prints the HTML report from a hidden frame', async ({ page }, testInfo) => {
    // Count print calls instead of opening the print dialog. Runs in every frame.
    await page.addInitScript(() => {
      window.print = () => {
        const top = window.top as unknown as { printed?: number };
        top.printed = (top.printed ?? 0) + 1;
      };
    });
    const app = new App(page);
    await app.open();
    await app.loadScenario(testInfo);
    await app.pair(1, 1);

    await page.getByLabel('Report format').selectOption({ label: 'PDF (print)' });
    await page.getByRole('button', { name: 'Export report' }).click();
    const frame = page.frameLocator('iframe[data-testid="print-frame"]');
    await expect(frame.locator('h1')).toHaveText('HAR comparison: legacy.har vs new.har');
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { printed?: number }).printed))
      .toBe(1);
  });
});
