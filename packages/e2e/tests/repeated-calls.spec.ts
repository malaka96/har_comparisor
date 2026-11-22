import { expect, test } from '@playwright/test';
import { entry, har, writeHar } from '../fixtures/har-fixtures.ts';
import { App } from './app.ts';

const users = (page: string, names: string[]) =>
  entry({
    path: '/api/users',
    query: { page },
    response: { mimeType: 'application/json', text: JSON.stringify({ page, names }) },
  });

test('A5: repeated calls to one endpoint are paired with the intended counterpart', async ({
  page,
}, testInfo) => {
  const app = new App(page);
  await app.open();
  // The new app calls page 2 before page 1.
  await app.load(
    'legacy',
    writeHar(testInfo.outputPath('legacy.har'), har([users('1', ['a']), users('2', ['b'])])),
  );
  await app.load(
    'new',
    writeHar(testInfo.outputPath('new.har'), har([users('2', ['b']), users('1', ['a'])])),
  );
  await expect(app.rows('legacy')).toHaveCount(2);
  await expect(app.rows('new')).toHaveCount(2);

  // A wrong pairing shows the query difference...
  await app.select(0, 0);
  await expect(app.verdict).toHaveText('Different');
  await expect(app.summaryRow('\\?page')).toContainText('1');
  await expect(app.summaryRow('\\?page')).toContainText('2');

  // ...and the intended pairing is identical.
  await app.pair(0, 1);
  await app.pair(1, 0);
  await expect(page.locator('.marker.pending')).toHaveCount(0);
  await expect(app.counts).toContainText('Identical: 2');
  await expect(app.counts).toContainText('Different: 0');
});
