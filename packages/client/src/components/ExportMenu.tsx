import { useState } from 'react';
import { errorMessage, fetchReport, type ReportRequest } from '../api';

type ExportFormat = 'json' | 'text' | 'html' | 'pdf';

interface Props {
  /** Builds the report request, or undefined when both HARs are not loaded yet. */
  request: ((format: ReportRequest['format'], redact: boolean) => ReportRequest) | undefined;
}

function download(fileName: string, content: Blob) {
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before the URL is released.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Prints the HTML report from a hidden frame, so the browser's "Save as PDF" makes the PDF.
 * The report has no scripts and every value in it is escaped.
 */
async function printHtml(content: Blob) {
  document.querySelector('iframe[data-testid="print-frame"]')?.remove();
  const frame = document.createElement('iframe');
  frame.dataset['testid'] = 'print-frame';
  frame.title = 'Report for printing';
  frame.className = 'print-frame';
  frame.srcdoc = await content.text();
  frame.addEventListener('load', () => frame.contentWindow?.print(), { once: true });
  document.body.append(frame);
}

/** Report export: format choice, secret redaction (on by default), and the export button. */
export function ExportMenu({ request }: Props) {
  const [format, setFormat] = useState<ExportFormat>('html');
  const [redact, setRedact] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function exportReport() {
    if (!request) return;
    setBusy(true);
    setError(undefined);
    try {
      const file = await fetchReport(request(format === 'pdf' ? 'html' : format, redact));
      if (format === 'pdf') await printHtml(file.content);
      else download(file.fileName, file.content);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="export" data-testid="export">
      <select
        aria-label="Report format"
        value={format}
        onChange={(event) => setFormat(event.target.value as ExportFormat)}
      >
        <option value="html">HTML</option>
        <option value="pdf">PDF (print)</option>
        <option value="text">Text</option>
        <option value="json">JSON</option>
      </select>
      <label title="Replace credentials, tokens and other secret values with [redacted]">
        <input
          type="checkbox"
          checked={redact}
          onChange={(event) => setRedact(event.target.checked)}
        />
        Redact secrets
      </label>
      <button className="button" disabled={!request || busy} onClick={() => void exportReport()}>
        {busy ? 'Exporting...' : 'Export report'}
      </button>
      {error && (
        <span className="export-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
