import { useRef, useState, type DragEvent } from 'react';
import type { HarSummaryResponse } from '@har-comparisor/shared';
import { deleteHar, errorMessage, uploadHar } from '../api';
import { formatBytes } from '../format';
import { EntryTable, type RowMarker } from './EntryTable';

interface LoadError {
  fileName: string;
  message: string;
}

interface Props {
  /** Short name used in labels and test ids, for example `legacy`. */
  side: string;
  title: string;
  har: HarSummaryResponse | undefined;
  onLoaded: (har: HarSummaryResponse) => void;
  selectedIndex: number | undefined;
  onSelect: (index: number) => void;
  markers: Map<number, RowMarker>;
}

/** Loads a HAR for one side and lists its requests. */
export function HarPane({ side, title, har, onLoaded, selectedIndex, onSelect, markers }: Props) {
  const [loadingName, setLoadingName] = useState<string>();
  const [error, setError] = useState<LoadError>();
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function load(file: File) {
    setLoadingName(file.name);
    setError(undefined);
    try {
      const loaded = await uploadHar(file);
      const previous = har;
      onLoaded(loaded);
      // Free the memory of the HAR that was replaced.
      if (previous) void deleteHar(previous.id).catch(() => undefined);
    } catch (caught) {
      // A file that fails to load does not remove the HAR that is already shown.
      setError({ fileName: file.name, message: errorMessage(caught) });
    } finally {
      setLoadingName(undefined);
    }
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void load(file);
  }

  return (
    <section
      className={dragging ? 'pane dragging' : 'pane'}
      aria-label={`${title} HAR`}
      data-testid={`pane-${side}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <header className="pane-header">
        <h2>{title}</h2>
        <button
          className="button"
          disabled={loadingName !== undefined}
          onClick={() => input.current?.click()}
        >
          {har ? 'Load another file' : 'Choose HAR file'}
        </button>
        <input
          ref={input}
          type="file"
          accept=".har,.json,application/json"
          hidden
          aria-label={`${title} HAR file`}
          data-testid={`file-${side}`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void load(file);
          }}
        />
      </header>

      {loadingName !== undefined && (
        <div className="banner" role="status">
          Loading {loadingName}...
        </div>
      )}
      {error && (
        <div className="banner error" role="alert" data-testid={`error-${side}`}>
          <strong>{error.fileName}</strong> could not be loaded. {error.message}
        </div>
      )}

      {!har && loadingName === undefined && !error && (
        <div className="body-message">Choose a HAR file, or drop it here.</div>
      )}

      {har && (
        <>
          <div className="file-info" data-testid={`info-${side}`}>
            <strong title={har.fileName}>{har.fileName}</strong>
            <span>{formatBytes(har.sizeBytes)}</span>
            <span>
              {har.entries.length} request{har.entries.length === 1 ? '' : 's'}
            </span>
            {har.creator && <span>{har.creator}</span>}
          </div>
          {har.warnings.length > 0 && (
            <details className="warnings" data-testid={`warnings-${side}`}>
              <summary>
                {har.warnings.length} warning{har.warnings.length === 1 ? '' : 's'}
                {har.skippedCount > 0 && `, ${har.skippedCount} skipped`}
              </summary>
              <ul>
                {har.warnings.map((warning, i) => (
                  <li key={i}>{warning.message}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="pane-content scroll">
            <EntryTable
              side={side}
              entries={har.entries}
              selectedIndex={selectedIndex}
              onSelect={onSelect}
              markers={markers}
            />
          </div>
        </>
      )}
    </section>
  );
}
