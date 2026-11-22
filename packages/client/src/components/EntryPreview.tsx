import { useState } from 'react';
import { describeBody } from '../body-display';
import { statusClass, statusLabel } from '../format';
import { useEntry } from '../use-entry';
import { BodyViewer } from './BodyViewer';

type Tab = 'response' | 'request';

interface Props {
  harId: string;
  index: number | undefined;
}

export function EntryPreview({ harId, index }: Props) {
  const [tab, setTab] = useState<Tab>('response');
  const state = useEntry(harId, index);

  if (state.status === 'idle') {
    return <div className="body-message">Select a request to preview its body.</div>;
  }
  if (state.status === 'loading') return <div className="body-message">Loading...</div>;
  if (state.status === 'error') {
    return (
      <div className="body-message error" role="alert">
        {state.message}
      </div>
    );
  }

  const { entry } = state;
  const body = tab === 'response' ? entry.response.body : entry.request.body;

  return (
    <div className="preview">
      <div className="preview-header">
        <span className={`status ${statusClass(entry.response.status)}`}>
          {statusLabel(entry.response.status)}
        </span>
        <span className="method">{entry.request.method}</span>
        <span className="preview-url" title={entry.request.url}>
          {entry.request.url}
        </span>
      </div>
      <div className="tabs" role="tablist">
        {(['response', 'request'] as const).map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={tab === name}
            className={tab === name ? 'tab active' : 'tab'}
            onClick={() => setTab(name)}
          >
            {name === 'response' ? 'Response body' : 'Request body'}
          </button>
        ))}
      </div>
      <div className="preview-body">
        <BodyViewer key={`${entry.index}:${tab}`} display={describeBody(body)} />
      </div>
    </div>
  );
}
