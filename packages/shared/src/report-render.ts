import type { Report, ReportDifference, ReportPair, ReportRequest } from './report.js';

export type ReportFormat = 'json' | 'text' | 'html';

export function renderJson(report: Report): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function requestLine(request: ReportRequest): string {
  return `${request.method} ${request.url} (${request.status === 0 ? 'failed' : request.status})`;
}

function differenceLine(d: ReportDifference): string {
  const where = d.field ? `${d.area} ${d.field}` : d.area;
  const values =
    d.legacy !== undefined || d.new !== undefined
      ? `: ${d.legacy ?? '(none)'} -> ${d.new ?? '(none)'}`
      : '';
  const note = d.note ? ` (${d.note})` : '';
  return `${where} [${d.kind}]${values}${note}`;
}

function pairFlags(pair: ReportPair): string {
  const flags = [pair.verdict.toUpperCase()];
  if (pair.headersDiffer) flags.push('headers differ');
  if (pair.outOfOrder) flags.push('out of order');
  return flags.join(', ');
}

export function renderText(report: Report): string {
  const s = report.summary;
  const lines: string[] = [
    report.title,
    `Generated: ${report.generatedAt}${report.redacted ? ' (secrets redacted)' : ''}`,
    `Legacy: ${report.legacy.fileName} (${report.legacy.requests} requests)`,
    `New:    ${report.new.fileName} (${report.new.requests} requests)`,
    '',
    'Summary',
    `  Pairs: ${s.pairs}  Identical: ${s.identical}  Different: ${s.different}`,
    `  Header differences: ${s.headerDifferences}  Out of order: ${s.outOfOrder}`,
    `  Missing in new: ${s.missing}  Extra in new: ${s.extra}`,
    '',
    'Pairs',
  ];
  for (const pair of report.pairs) {
    lines.push(`#${pair.number} ${pairFlags(pair)}`);
    lines.push(`  legacy #${pair.legacy.index}: ${requestLine(pair.legacy)}`);
    lines.push(`  new    #${pair.new.index}: ${requestLine(pair.new)}`);
    for (const d of pair.differences) lines.push(`  - ${differenceLine(d)}`);
  }
  if (report.pairs.length === 0) lines.push('  (none)');
  lines.push('', 'Missing in new (only in legacy)');
  for (const r of report.missing) lines.push(`  #${r.index} ${requestLine(r)}`);
  if (report.missing.length === 0) lines.push('  (none)');
  lines.push('', 'Extra in new (only in new)');
  for (const r of report.extra) lines.push(`  #${r.index} ${requestLine(r)}`);
  if (report.extra.length === 0) lines.push('  (none)');
  return `${lines.join('\n')}\n`;
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes text for HTML. All report values come from HAR files and are untrusted. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c] as string);
}

const STYLE = `
body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #1f2328; margin: 24px; }
h1 { font-size: 18px; margin: 0 0 4px; }
h2 { font-size: 15px; margin: 24px 0 8px; border-bottom: 1px solid #d9dce1; padding-bottom: 4px; }
.meta { color: #5b6470; margin: 2px 0; }
.summary { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.summary div { border: 1px solid #d9dce1; border-radius: 6px; padding: 6px 10px; }
.summary strong { display: block; font-size: 18px; }
table { border-collapse: collapse; width: 100%; table-layout: fixed; }
th, td { text-align: left; padding: 3px 6px; border-bottom: 1px solid #eef0f2; vertical-align: top; word-break: break-word; }
th { background: #f4f5f7; }
.pair { margin: 14px 0; page-break-inside: avoid; }
.pair h3 { font-size: 13px; margin: 0 0 4px; }
.identical { color: #1a7f37; }
.different { color: #b35900; }
.flag { color: #0969da; font-weight: normal; }
.none { color: #5b6470; }
@media print { body { margin: 0; } }
`;

function requestCell(request: ReportRequest): string {
  return `#${request.index} ${escapeHtml(request.method)} ${escapeHtml(request.url)} <span class="none">(${request.status === 0 ? 'failed' : request.status})</span>`;
}

function pairHtml(pair: ReportPair): string {
  const flags = [
    pair.headersDiffer ? '<span class="flag">headers differ</span>' : '',
    pair.outOfOrder ? '<span class="flag">out of order</span>' : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const rows = pair.differences
    .map(
      (d) =>
        `<tr><td>${escapeHtml(d.area)}</td><td>${escapeHtml(d.field)}</td><td>${escapeHtml(d.kind)}</td><td>${escapeHtml(d.legacy ?? '')}</td><td>${escapeHtml(d.new ?? '')}${d.note ? ` <span class="none">${escapeHtml(d.note)}</span>` : ''}</td></tr>`,
    )
    .join('');
  return `<div class="pair">
<h3>#${pair.number} <span class="${pair.verdict}">${pair.verdict === 'identical' ? 'Identical' : 'Different'}</span> ${flags}</h3>
<div>Legacy: ${requestCell(pair.legacy)}</div>
<div>New: ${requestCell(pair.new)}</div>
${
  pair.differences.length === 0
    ? '<p class="none">No differences.</p>'
    : `<table><colgroup><col style="width:14%"><col style="width:22%"><col style="width:10%"><col style="width:27%"><col style="width:27%"></colgroup><thead><tr><th>Part</th><th>Field</th><th>Change</th><th>Legacy</th><th>New</th></tr></thead><tbody>${rows}</tbody></table>`
}
</div>`;
}

function requestList(requests: ReportRequest[]): string {
  if (requests.length === 0) return '<p class="none">None.</p>';
  return `<ul>${requests.map((r) => `<li>${requestCell(r)}</li>`).join('')}</ul>`;
}

/** A self-contained HTML page: no scripts, no external files. Printable to PDF from a browser. */
export function renderHtml(report: Report): string {
  const s = report.summary;
  const box = (label: string, value: number) => `<div>${label}<strong>${value}</strong></div>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(report.title)}</title>
<style>${STYLE}</style>
</head>
<body>
<h1>${escapeHtml(report.title)}</h1>
<p class="meta">Generated ${escapeHtml(report.generatedAt)}${report.redacted ? ' · secrets redacted' : ' · not redacted'}</p>
<p class="meta">Legacy: ${escapeHtml(report.legacy.fileName)} (${report.legacy.requests} requests) · New: ${escapeHtml(report.new.fileName)} (${report.new.requests} requests)</p>
<div class="summary">
${box('Pairs', s.pairs)}${box('Identical', s.identical)}${box('Different', s.different)}${box('Header differences', s.headerDifferences)}${box('Out of order', s.outOfOrder)}${box('Missing in new', s.missing)}${box('Extra in new', s.extra)}
</div>
<h2>Pairs</h2>
${report.pairs.length === 0 ? '<p class="none">No pairs.</p>' : report.pairs.map(pairHtml).join('\n')}
<h2>Missing in new (only in legacy)</h2>
${requestList(report.missing)}
<h2>Extra in new (only in new)</h2>
${requestList(report.extra)}
</body>
</html>
`;
}

export function renderReport(report: Report, format: ReportFormat): string {
  switch (format) {
    case 'json':
      return renderJson(report);
    case 'text':
      return renderText(report);
    case 'html':
      return renderHtml(report);
  }
}
