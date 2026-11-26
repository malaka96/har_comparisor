import { expect, test } from '@playwright/test';
import { App } from './app.ts';

test.describe('maximize the comparison', () => {
  test('the comparison fills the page and comes back with Minimize or Esc', async ({
    page,
  }, testInfo) => {
    const app = new App(page);
    await app.open();
    await app.loadScenario(testInfo);
    await app.pair(0, 0);

    const button = page.getByTestId('maximize');
    const viewport = page.viewportSize()!;
    const normal = (await app.comparison.boundingBox())!;
    expect(normal.height).toBeLessThan(viewport.height * 0.7);

    await button.click();
    await expect(button).toHaveText('Minimize');
    await expect(app.comparison).toHaveAttribute('data-maximized', 'true');
    const full = (await app.comparison.boundingBox())!;
    expect(full).toEqual({ x: 0, y: 0, width: viewport.width, height: viewport.height });
    // The lists are covered: a click there lands on the comparison, not on a row.
    const legacyRow = (await app.row('legacy', 1).boundingBox())!;
    const hit = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x!, y!)?.closest('[data-testid="comparison"]') !== null,
      [legacyRow.x + 5, legacyRow.y + 5],
    );
    expect(hit).toBe(true);
    // The diff editor grows with it.
    const editor = page.getByTestId('body-diff');
    await expect
      .poll(async () => (await editor.boundingBox())?.height ?? 0)
      .toBeGreaterThan(normal.height);

    await button.click();
    await expect(button).toHaveText('Maximize');
    await expect(app.comparison).toHaveAttribute('data-maximized', 'false');
    expect((await app.comparison.boundingBox())!.height).toBeCloseTo(normal.height, 0);

    await button.click();
    await expect(button).toHaveText('Minimize');
    await page.keyboard.press('Escape');
    await expect(button).toHaveText('Maximize');
    // The pairs and selection are untouched.
    await expect(app.counts).toContainText('Pairs: 1');
    await expect(app.row('legacy', 0)).toHaveClass(/selected/);
  });
});
