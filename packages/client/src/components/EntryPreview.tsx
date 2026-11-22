import { useState } from 'react';
import { describeBody } from '../body-display';
import { statusClass, statusLabel } from '../format';
import { useEntry } from '../use-entry';
import { BodyTabs, type BodyTab } from './BodyTabs';
import { BodyViewer } from './BodyViewer';

interface Props {
  harId: string;
  index: number;
  /** Shown before the URL, for example "Legacy". */
  label: string;
}

/** Shows one request on its own, when it has no counterpart selected. */
export function EntryPreview({ harId, index, label }: Props) {
  const [tab, setTab] = useState<BodyTab>('response');
  const state = useEntry(harId, index);

  if (state.status === 'idle' || state.status === 'loading') {
    return <div className="body-message">Loading...</div>;
  }
  if (state.status === 'error') {
    return (
      <div className="body-message error" role="alert">
        {state.message}
      </div>
    );
  }

  const entry = state.value;
  const body = tab === 'response' ? entry.response.body : entry.request.body;

  return (
    <div className="preview" data-testid="entry-preview">
      <div className="preview-header">
        <span className="side-label">{label}</span>
        <span className={`status ${statusClass(entry.response.status)}`}>
          {statusLabel(entry.response.status)}
        </span>
        <span className="method">{entry.request.method}</span>
        <span className="preview-url" title={entry.request.url}>
          {entry.request.url}
        </span>
      </div>
      <BodyTabs tab={tab} onChange={setTab} />
      <div className="preview-body">
        <BodyViewer key={`${entry.index}:${tab}`} display={describeBody(body)} />
      </div>
    </div>
  );
}
