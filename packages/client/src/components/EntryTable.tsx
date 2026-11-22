import type { EntrySummary } from '@har-comparisor/shared';
import { formatBytes, formatTime, statusClass, statusLabel } from '../format';

export type MarkerTone = 'identical' | 'different' | 'pending' | 'missing' | 'extra';

export interface RowMarker {
  label: string;
  tone: MarkerTone;
  title: string;
}

interface Props {
  side: string;
  entries: EntrySummary[];
  selectedIndex: number | undefined;
  onSelect: (index: number) => void;
  markers: Map<number, RowMarker>;
}

export function EntryTable({ side, entries, selectedIndex, onSelect, markers }: Props) {
  if (entries.length === 0) {
    return <div className="body-message">This HAR has no readable requests.</div>;
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
      <tbody>
        {entries.map((entry) => {
          const marker = markers.get(entry.index);
          return (
            <tr
              key={entry.index}
              className={entry.index === selectedIndex ? 'selected' : undefined}
              tabIndex={0}
              data-index={entry.index}
              onClick={() => onSelect(entry.index)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(entry.index);
                }
              }}
              aria-selected={entry.index === selectedIndex}
            >
              <td className="col-index">{entry.index}</td>
              <td className="col-pair">
                {marker && (
                  <span className={`marker ${marker.tone}`} title={marker.title}>
                    {marker.label}
                  </span>
                )}
              </td>
              <td className="col-method">{entry.method}</td>
              <td className="col-status">
                <span className={`status ${statusClass(entry.status)}`}>
                  {statusLabel(entry.status)}
                </span>
              </td>
              <td className="col-path" title={entry.url}>
                {entry.path}
              </td>
              <td className="col-type">{entry.resourceType ?? ''}</td>
              <td className="col-size">{formatBytes(entry.size)}</td>
              <td className="col-time">{formatTime(entry.time)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
