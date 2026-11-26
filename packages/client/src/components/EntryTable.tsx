import { memo, useEffect, useRef, type KeyboardEvent, type MouseEvent } from 'react';
import type { EntrySummary } from '@har-comparisor/shared';
import { formatBytes, formatTime, statusClass, statusLabel } from '../format';

export type MarkerTone = 'identical' | 'different' | 'error' | 'pending' | 'missing' | 'extra';

export interface RowMarker {
  label: string;
  tone: MarkerTone;
  title: string;
  /** True when this pair is called in a different order than the other pairs. */
  outOfOrder?: boolean;
}

interface Props {
  side: string;
  entries: EntrySummary[];
  selectedIndex: number | undefined;
  onSelect: (index: number) => void;
  markers: Map<number, RowMarker>;
}

interface RowProps {
  entry: EntrySummary;
  selected: boolean;
  marker: RowMarker | undefined;
}

function sameMarker(a: RowMarker | undefined, b: RowMarker | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.label === b.label && a.tone === b.tone && a.title === b.title && a.outOfOrder === b.outOfOrder
  );
}

/**
 * One request row. Memoized so that a click re-renders only the rows whose
 * selection or marker changed, which keeps large HARs (thousands of rows) responsive.
 */
const Row = memo(
  function Row({ entry, selected, marker }: RowProps) {
    return (
      <tr
        className={selected ? 'selected' : undefined}
        tabIndex={0}
        data-index={entry.index}
        aria-selected={selected}
      >
        <td className="col-index">{entry.index}</td>
        <td className="col-pair">
          {marker && (
            <span className={`marker ${marker.tone}`} title={marker.title}>
              {marker.label}
            </span>
          )}
          {marker?.outOfOrder && (
            <span
              className="order-flag"
              data-testid="order-flag"
              title="Called in a different order than in the other HAR"
            >
              ↕
            </span>
          )}
        </td>
        <td className="col-method">{entry.method}</td>
        <td className="col-status">
          <span className={`status ${statusClass(entry.status)}`}>{statusLabel(entry.status)}</span>
        </td>
        <td className="col-path" title={entry.url}>
          {entry.path}
        </td>
        <td className="col-type">{entry.resourceType ?? ''}</td>
        <td className="col-size">{formatBytes(entry.size)}</td>
        <td className="col-time">{formatTime(entry.time)}</td>
      </tr>
    );
  },
  (a, b) => a.entry === b.entry && a.selected === b.selected && sameMarker(a.marker, b.marker),
);

/** Index of the row an event happened in, read from `data-index`. */
function rowIndex(target: EventTarget): number | undefined {
  const row = (target as HTMLElement).closest('tr[data-index]');
  const value = row?.getAttribute('data-index');
  return value === null || value === undefined ? undefined : Number(value);
}

export function EntryTable({ side, entries, selectedIndex, onSelect, markers }: Props) {
  const body = useRef<HTMLTableSectionElement>(null);

  // Keep the selected row visible, for example when it was selected as a partner.
  useEffect(() => {
    if (selectedIndex === undefined) return;
    body.current
      ?.querySelector(`tr[data-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (entries.length === 0) {
    return <div className="body-message">This HAR has no readable requests.</div>;
  }

  // One handler for the whole table instead of one per row.
  function onClick(event: MouseEvent<HTMLTableSectionElement>) {
    const index = rowIndex(event.target);
    if (index !== undefined) onSelect(index);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTableSectionElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const index = rowIndex(event.target);
    if (index === undefined) return;
    event.preventDefault();
    onSelect(index);
  }

  return (
    <table className="entries" data-testid={`entries-${side}`}>
      <thead>
        <tr>
          <th className="col-index">#</th>
          <th className="col-pair">Pair</th>
          <th className="col-method">Method</th>
          <th className="col-status">Status</th>
          <th>Path</th>
          <th className="col-type">Type</th>
          <th className="col-size">Size</th>
          <th className="col-time">Time</th>
        </tr>
      </thead>
      <tbody ref={body} onClick={onClick} onKeyDown={onKeyDown}>
        {entries.map((entry) => (
          <Row
            key={entry.index}
            entry={entry}
            selected={entry.index === selectedIndex}
            marker={markers.get(entry.index)}
          />
        ))}
      </tbody>
    </table>
  );
}
