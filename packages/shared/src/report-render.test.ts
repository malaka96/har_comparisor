import { describe, expect, it } from 'vitest';
import type { Report } from './report.js';
import { escapeHtml, renderHtml, renderJson, renderReport, renderText } from './report-render.js';

const report: Report = {
  title: 'HAR comparison: a.har vs b.har',
  generatedAt: '2026-01-01T00:00:00.000Z',
  redacted: true,
  legacy: { fileName: 'a.har', requests: 3 },
  new: { fileName: 'b.har', requests: 3 },
  summary: {
    pairs: 2,
    identical: 1,
    different: 1,
    headerDifferences: 1,
    outOfOrder: 1,
    missing: 1,
    extra: 1,
  },
  pairs: [
    {
      number: 1,
      legacy: { index: 0, method: 'GET', url: '/a', status: 200 },
      new: { index: 0, method: 'GET', url: '/a', status: 200 },
      verdict: 'identical',
      headersDiffer: false,
      outOfOrder: false,
      differences: [],
    },
    {
      number: 2,
      legacy: { index: 1, method: 'POST', url: '/b?x=1', status: 500 },
      new: { index: 2, method: 'POST', url: '/b?x=1', status: 200 },
      verdict: 'different',
      headersDiffer: true,
      outOfOrder: true,
      differences: [
        { area: 'status', field: '', kind: 'changed', legacy: '500', new: '200' },
        {
          area: 'response body',
          field: '$.name',
          kind: 'value',
          legacy: '"<script>alert(1)</script>"',
          new: '"Bob"',
        },
        { area: 'response body', field: '', kind: 'changed', note: 'Only one side is valid JSON' },
      ],
    },
  ],
  missing: [{ index: 2, method: 'GET', url: '/old', status: 0 }],
  extra: [{ index: 1, method: 'GET', url: '/new', status: 404 }],
};

describe('renderJson', () => {
  it('round-trips the report', () => {
    expect(JSON.parse(renderJson(report))).toEqual(report);
  });
});

describe('renderText', () => {
  it('lists the summary, pairs with differences, missing and extra requests', () => {
    const text = renderText(report);
    expect(text).toContain('Pairs: 2  Identical: 1  Different: 1');
    expect(text).toContain('#2 DIFFERENT, headers differ, out of order');
    expect(text).toContain('  legacy #1: POST /b?x=1 (500)');
    expect(text).toContain('  - status [changed]: 500 -> 200');
    expect(text).toContain(
      '  - response body $.name [value]: "<script>alert(1)</script>" -> "Bob"',
    );
    expect(text).toContain('  - response body [changed] (Only one side is valid JSON)');
    expect(text).toContain('  #2 GET /old (failed)');
    expect(text).toContain('  #1 GET /new (404)');
    expect(text).toContain('(secrets redacted)');
  });
});

describe('renderHtml', () => {
  it('escapes every value from the HAR files', () => {
    const html = renderHtml(report);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('is a self-contained page with the summary and all sections', () => {
    const html = renderHtml(report);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).not.toMatch(/<script|<link|src=/);
    expect(html).toContain('Header differences<strong>1</strong>');
    expect(html).toContain('Missing in new (only in legacy)');
    expect(html).toContain('No differences.');
    expect(html).toContain('secrets redacted');
  });
});

describe('escapeHtml', () => {
  it('escapes the five special characters', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });
});

describe('renderReport', () => {
  it('picks the renderer by format', () => {
    expect(renderReport(report, 'json')).toBe(renderJson(report));
    expect(renderReport(report, 'text')).toBe(renderText(report));
    expect(renderReport(report, 'html')).toBe(renderHtml(report));
  });
});
