import { expect, type Page, type TestInfo } from '@playwright/test';
import { legacyScenario, newScenario, writeHar } from '../fixtures/har-fixtures.ts';

/** Small helpers that describe the UI in the words the tests use. */
export class App {
  constructor(readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.goto('/');
    await expect(this.page).toHaveTitle('HAR Comparisor');
  }

  async load(side: 'legacy' | 'new', file: string): Promise<void> {
    await this.page.getByTestId(`file-${side}`).setInputFiles(file);
  }

  /** Loads the main synthetic scenario on both sides and waits for both lists. */
  async loadScenario(testInfo: TestInfo): Promise<void> {
    await this.load('legacy', writeHar(testInfo.outputPath('legacy.har'), legacyScenario()));
    await this.load('new', writeHar(testInfo.outputPath('new.har'), newScenario()));
    await expect(this.rows('legacy')).toHaveCount(8);
    await expect(this.rows('new')).toHaveCount(10);
  }

  rows(side: 'legacy' | 'new') {
    return this.page.getByTestId(`entries-${side}`).locator('tbody tr');
  }

  row(side: 'legacy' | 'new', index: number) {
    return this.page.getByTestId(`entries-${side}`).locator(`tr[data-index="${index}"]`);
  }

  marker(side: 'legacy' | 'new', index: number) {
    return this.row(side, index).locator('.marker');
  }

  get pairButton() {
    return this.page.getByRole('button', { name: 'Pair selected' });
  }

  get unpairButton() {
    return this.page.getByRole('button', { name: 'Unpair' });
  }

  get counts() {
    return this.page.getByTestId('counts');
  }

  get comparison() {
    return this.page.getByTestId('comparison');
  }

  get verdict() {
    return this.page.getByTestId('verdict');
  }

  summaryRow(label: string) {
    return this.page
      .getByTestId('comparison-summary')
      .locator('tbody tr')
      .filter({ has: this.page.locator('th', { hasText: new RegExp(`^${label}$`) }) });
  }

  tab(name: 'Response body' | 'Request body' | 'Response headers' | 'Request headers') {
    return this.page.getByRole('tab', { name: new RegExp(name) });
  }

  get changeRows() {
    return this.page.getByTestId('change-list').locator('table.changes tbody tr');
  }

  async select(legacy: number, next: number): Promise<void> {
    await this.row('legacy', legacy).click();
    await this.row('new', next).click();
  }

  async pair(legacy: number, next: number): Promise<void> {
    await this.select(legacy, next);
    await this.pairButton.click();
    await expect(this.marker('legacy', legacy)).toHaveText(/^#\d+$/);
  }

  /** Pairs every equivalent request of the main scenario. */
  async pairScenario(): Promise<void> {
    for (const [l, n] of [
      [0, 0],
      [1, 1],
      [2, 3],
      [3, 2],
      [4, 4],
      [5, 5],
      [6, 6],
    ] as const) {
      await this.pair(l, n);
    }
    await expect(this.page.locator('.marker.pending')).toHaveCount(0);
  }
}
