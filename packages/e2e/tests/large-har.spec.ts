import { expect, test } from '@playwright/test';
import { largeHar, writeHar } from '../fixtures/har-fixtures.ts';
import { App } from './app.ts';

// About 40 MB per side: well above the typical 15 MB.
const COUNT = Number(process.env['E2E_LARGE_COUNT'] ?? 4000);
const BODY_BYTES = 10_000;

// Playwright's trace recorder walks every DOM node after each action, which costs seconds
// on 8000 table rows and would hide the app's own timing. This test measures the app, so no trace.
test.use({ trace: 'off' });

test('A3: a large HAR loads, lists and compares without freezing the page', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const app = new App(page);
  const legacyFile = writeHar(
    testInfo.outputPath('large-legacy.har'),
    largeHar(COUNT, BODY_BYTES, 'a'),
  );
  const newFile = writeHar(testInfo.outputPath('large-new.har'), largeHar(COUNT, BODY_BYTES, 'b'));

  await app.open();

  const timings: Record<string, number> = {};
  const time = async (name: string, action: () => Promise<void>) => {
    const started = Date.now();
    await action();
    timings[name] = Date.now() - started;
  };

  await time('load legacy', async () => {
    await app.load('legacy', legacyFile);
    await expect(app.rows('legacy')).toHaveCount(COUNT, { timeout: 60_000 });
  });
  await time('load new', async () => {
    await app.load('new', newFile);
    await expect(app.rows('new')).toHaveCount(COUNT, { timeout: 60_000 });
  });

  // The page must stay responsive: a click right after loading is handled quickly.
  await time('select and compare', async () => {
    await app.select(500, 500);
    await expect(app.verdict).toHaveText('Different');
  });
  await expect(app.changeRows).toHaveCount(1);
  await expect(app.changeRows.first()).toContainText('$.price');

  await time('pair', async () => {
    await app.pairButton.click();
    await expect(app.marker('legacy', 500)).toHaveClass(/different/);
  });

  await time('select far row', async () => {
    await app.row('legacy', COUNT - 1).click();
    await expect(app.row('legacy', COUNT - 1)).toHaveClass(/selected/);
  });

  // Measures the longest frame while scrolling the list.
  const longestFrame = await page.evaluate(async () => {
    const scroller = document.querySelector(
      '[data-testid=pane-legacy] .pane-content',
    ) as HTMLElement;
    let last = performance.now();
    let longest = 0;
    for (let i = 0; i < 40; i++) {
      scroller.scrollTop += 2000;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const now = performance.now();
      longest = Math.max(longest, now - last);
      last = now;
    }
    return Math.round(longest);
  });
  timings['longest scroll frame'] = longestFrame;

  const summary = Object.entries(timings)
    .map(([name, ms]) => `${name}: ${ms} ms`)
    .join(', ');
  testInfo.annotations.push({
    type: 'timings',
    description: `${COUNT} requests per side. ${summary}`,
  });
  console.log(`[large HAR] ${COUNT} requests per side. ${summary}`);

  // Limits are generous on purpose: they catch a freeze, not small slowdowns. Times include
  // Playwright's own checks, which also walk the large DOM. Measured on the development machine:
  // about 4 s and 1.1 s here, against about 1.5 s and 0.3 s for the same actions inside the page.
  expect(timings['select and compare']).toBeLessThan(10_000);
  expect(timings['select far row']).toBeLessThan(4_000);
  expect(longestFrame).toBeLessThan(500);
});
