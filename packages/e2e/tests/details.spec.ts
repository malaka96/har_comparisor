import { expect, test } from '@playwright/test';
import { entry, har, writeHar } from '../fixtures/har-fixtures.ts';
import { App } from './app.ts';

const json = (value: unknown) => ({ mimeType: 'application/json', text: JSON.stringify(value) });

test.describe('F14: extra difference details', () => {
  test('status text and class, content type and call counts', async ({ page }, testInfo) => {
    const app = new App(page);
    await app.open();
    await app.loadScenario(testInfo);
    await app.pair(2, 3);

    await expect(app.summaryRow('Status')).toContainText('500 Internal Server Error (5xx)');
    await expect(app.summaryRow('Status')).toContainText('200 OK (2xx)');
    await expect(app.summaryRow('Content type')).toContainText('application/json');
    await expect(app.summaryRow('Content type')).not.toHaveClass(/differs/);
    await expect(app.summaryRow('Calls to endpoint')).not.toHaveClass(/differs/);
    await expect(app.summaryRow('Response size')).toHaveClass(/info/);
    await expect(app.summaryRow('Time')).toHaveClass(/info/);
  });

  test('decoded Base64 path segments, redirects and differing call counts', async ({
    page,
  }, testInfo) => {
    const app = new App(page);
    await app.open();
    // Legacy calls the profile endpoint twice, the new app once and with another id.
    await app.load(
      'legacy',
      writeHar(
        testInfo.outputPath('legacy.har'),
        har([
          entry({ path: '/api/profile/NzQ0MjQ5NTc0', response: json({ ok: true }) }),
          entry({ path: '/api/profile/NzQ0MjQ5NTc0', response: json({ ok: true }) }),
          entry({
            path: '/old',
            status: 302,
            statusText: 'Found',
            redirectUrl: 'https://api.example.test/a',
            response: { mimeType: '', size: 0 },
          }),
        ]),
      ),
    );
    await app.load(
      'new',
      writeHar(
        testInfo.outputPath('new.har'),
        har([
          entry({ path: '/api/profile/ODg4ODg4ODg4', response: json({ ok: true }) }),
          entry({
            path: '/old',
            status: 302,
            statusText: 'Found',
            redirectUrl: 'https://api.example.test/b',
            response: { mimeType: '', size: 0 },
          }),
        ]),
      ),
    );
    await expect(app.rows('legacy')).toHaveCount(3);
    await expect(app.rows('new')).toHaveCount(2);

    await app.select(0, 0);
    const segment = app.summaryRow('Path segment 3');
    await expect(segment).toHaveClass(/differs/);
    await expect(segment).toContainText('"744249574"');
    await expect(segment).toContainText('"888888888"');
    await expect(app.summaryRow('Calls to endpoint')).toHaveClass(/differs/);
    await expect(app.summaryRow('Calls to endpoint')).toContainText('2');

    await app.select(2, 1);
    await expect(app.summaryRow('Redirects to')).toHaveClass(/differs/);
    await expect(app.summaryRow('Redirects to')).toContainText('https://api.example.test/a');
    await expect(app.summaryRow('Redirects to')).toContainText('https://api.example.test/b');
  });
});
