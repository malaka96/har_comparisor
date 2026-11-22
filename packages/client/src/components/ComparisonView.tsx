import { useState } from 'react';
import type { BodyComparison, EntryComparison } from '@har-comparisor/shared';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { fetchComparison, type ComparisonTarget } from '../api';
import { statusLabel } from '../format';
import { useAsync } from '../use-async';
import { BodyDiff } from './BodyDiff';
import { BodyTabs, type BodyTab } from './BodyTabs';

function targetKey(t: ComparisonTarget): string {
  return `${t.legacyHarId}:${t.legacyIndex}:${t.newHarId}:${t.newIndex}`;
}

function bodyBadge(body: BodyComparison): string {
  if (body.identical) return 'same';
  if (body.kind === 'json') {
    const count = body.changes.length;
    return `${count}${body.truncated ? '+' : ''} change${count === 1 ? '' : 's'}`;
  }
  return 'differs';
}

function Row({
  label,
  legacy,
  next,
  same,
}: {
  label: string;
  legacy: string;
  next: string;
  same: boolean;
}) {
  return (
    <tr className={same ? undefined : 'differs'}>
      <th>{label}</th>
      <td>{legacy}</td>
      <td>{next}</td>
    </tr>
  );
}

function Summary({ comparison }: { comparison: EntryComparison }) {
  const { method, status, url } = comparison;
  return (
    <table className="summary-table" data-testid="comparison-summary">
      <colgroup>
        <col className="summary-label" />
        <col />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th />
          <th>Legacy</th>
          <th>New</th>
        </tr>
      </thead>
      <tbody>
        <Row label="Method" legacy={method.legacy} next={method.new} same={method.identical} />
        <Row
          label="Status"
          legacy={statusLabel(status.legacy)}
          next={statusLabel(status.new)}
          same={status.identical}
        />
        <Row
          label="Host"
          legacy={`${url.scheme.legacy}://${url.host.legacy}`}
          next={`${url.scheme.new}://${url.host.new}`}
          same={url.scheme.identical && url.host.identical}
        />
        <Row label="Path" legacy={url.path.legacy} next={url.path.new} same={url.path.identical} />
        {url.query.changes.map((change) => (
          <Row
            key={change.name}
            label={`?${change.name}`}
            legacy={change.legacy ?? '(not sent)'}
            next={change.new ?? '(not sent)'}
            same={false}
          />
        ))}
      </tbody>
    </table>
  );
}

function ChangeList({ body }: { body: BodyComparison }) {
  return (
    <div className="scroll change-list" data-testid="change-list">
      {body.note && <p className="note">{body.note}</p>}
      {body.identical && !body.note && <p className="note">The bodies are the same.</p>}
      {!body.identical && body.kind === 'text' && !body.note && (
        <p className="note">The bodies differ as text. See the highlighted lines.</p>
      )}
      {body.changes.length > 0 && (
        <table className="changes">
          <thead>
            <tr>
              <th>Field</th>
              <th>Change</th>
              <th>Legacy</th>
              <th>New</th>
            </tr>
          </thead>
          <tbody>
            {body.changes.map((change, i) => (
              <tr key={i} className={`change ${change.kind}`}>
                <td title={change.path}>{change.path}</td>
                <td>{change.kind}</td>
                <td title={change.legacy}>{change.legacy ?? ''}</td>
                <td title={change.new}>{change.new ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {body.truncated && (
        <p className="note">Only the first {body.changes.length} changes are listed.</p>
      )}
    </div>
  );
}

interface Props {
  target: ComparisonTarget;
  /** True when the two requests are an actual pair, false when only selected side by side. */
  paired: boolean;
}

export function ComparisonView({ target, paired }: Props) {
  const [tab, setTab] = useState<BodyTab>('response');
  const state = useAsync(targetKey(target), () => fetchComparison(target));

  if (state.status === 'idle' || state.status === 'loading') {
    return <div className="body-message">Comparing...</div>;
  }
  if (state.status === 'error') {
    return (
      <div className="body-message error" role="alert">
        {state.message}
      </div>
    );
  }

  const { legacy, new: next, comparison } = state.value;
  const body = tab === 'response' ? comparison.responseBody : comparison.requestBody;

  return (
    <div className="comparison" data-testid="comparison">
      <div className="comparison-header">
        <span
          className={comparison.identical ? 'verdict identical' : 'verdict different'}
          data-testid="verdict"
        >
          {comparison.identical ? 'Identical' : 'Different'}
        </span>
        {!paired && (
          <span className="hint">Not paired yet. Preview of the two selected requests.</span>
        )}
        <span className="preview-url" title={legacy.request.url}>
          {legacy.request.method} {legacy.request.path}
        </span>
      </div>
      <Summary comparison={comparison} />
      <BodyTabs
        tab={tab}
        onChange={setTab}
        badges={{
          response: bodyBadge(comparison.responseBody),
          request: bodyBadge(comparison.requestBody),
        }}
      />
      <div className="comparison-body">
        <Group orientation="horizontal">
          <Panel id="diff" defaultSize="70%" minSize="20%">
            <BodyDiff
              key={tab}
              legacy={tab === 'response' ? legacy.response.body : legacy.request.body}
              next={tab === 'response' ? next.response.body : next.request.body}
            />
          </Panel>
          <Separator className="separator vertical" />
          <Panel id="changes" minSize="10%">
            <ChangeList body={body} />
          </Panel>
        </Group>
      </div>
    </div>
  );
}
