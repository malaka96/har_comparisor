import { useState } from 'react';
import type { BodyComparison, EntryComparison, HeaderComparison } from '@har-comparisor/shared';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { fetchComparison, type ComparisonTarget } from '../api';
import { formatBytes, formatTime, statusLabel } from '../format';
import { useAsync } from '../use-async';
import { BodyDiff } from './BodyDiff';
import { BodyTabs, type DetailTab } from './BodyTabs';
import { HeaderTable } from './HeaderTable';

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
  info,
}: {
  label: string;
  legacy: string;
  next: string;
  same: boolean;
  /** Information only: shown greyed and never highlighted. */
  info?: boolean;
}) {
  const className = info ? 'info' : same ? undefined : 'differs';
  return (
    <tr className={className}>
      <th>{label}</th>
      <td title={legacy}>{legacy}</td>
      <td title={next}>{next}</td>
    </tr>
  );
}

function withDecoded(value: string, decoded: string | undefined): string {
  return decoded === undefined ? value : `${value}  →  "${decoded}"`;
}

const orNone = (value: string) => (value === '' ? '(none)' : value);

export interface CallCounts {
  legacy: number;
  new: number;
}

function Summary({
  comparison,
  callCounts,
}: {
  comparison: EntryComparison;
  callCounts: CallCounts | undefined;
}) {
  const { method, status, url, details } = comparison;
  const statusText = (code: number, text: string, cls: string) =>
    `${statusLabel(code)}${text ? ` ${text}` : ''} (${cls})`;
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
          legacy={statusText(status.legacy, details.statusText.legacy, details.statusClass.legacy)}
          next={statusText(status.new, details.statusText.new, details.statusClass.new)}
          same={status.identical}
        />
        <Row
          label="Host"
          legacy={`${url.scheme.legacy}://${url.host.legacy}`}
          next={`${url.scheme.new}://${url.host.new}`}
          same={url.scheme.identical && url.host.identical}
        />
        <Row label="Path" legacy={url.path.legacy} next={url.path.new} same={url.path.identical} />
        {details.pathSegments.map((segment) => (
          <Row
            key={`segment-${segment.position}`}
            label={`Path segment ${segment.position}`}
            legacy={withDecoded(segment.legacy, segment.legacyDecoded)}
            next={withDecoded(segment.new, segment.newDecoded)}
            same={false}
          />
        ))}
        {url.query.changes.map((change) => (
          <Row
            key={change.name}
            label={`?${change.name}`}
            legacy={change.legacy ?? '(not sent)'}
            next={change.new ?? '(not sent)'}
            same={false}
          />
        ))}
        <Row
          label="Content type"
          legacy={orNone(details.contentType.legacy)}
          next={orNone(details.contentType.new)}
          same={details.contentType.identical}
        />
        {(details.redirect.legacy !== '' || details.redirect.new !== '') && (
          <Row
            label="Redirects to"
            legacy={orNone(details.redirect.legacy)}
            next={orNone(details.redirect.new)}
            same={details.redirect.identical}
          />
        )}
        {callCounts && (
          <Row
            label="Calls to endpoint"
            legacy={String(callCounts.legacy)}
            next={String(callCounts.new)}
            same={callCounts.legacy === callCounts.new}
          />
        )}
        <Row
          label="Response size"
          legacy={formatBytes(details.responseSize.legacy) || 'unknown'}
          next={formatBytes(details.responseSize.new) || 'unknown'}
          same
          info
        />
        <Row
          label="Time"
          legacy={formatTime(details.time.legacy) || 'unknown'}
          next={formatTime(details.time.new) || 'unknown'}
          same
          info
        />
      </tbody>
    </table>
  );
}

const CHANGE_LABELS = {
  value: 'value',
  type: 'type',
  added: 'added',
  removed: 'removed',
  order: 'order only',
} as const;

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
                <td>{CHANGE_LABELS[change.kind]}</td>
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
  /** How often each HAR calls the endpoint (same method and path) of its selected request. */
  callCounts?: CallCounts;
  /** True when the comparison fills the whole page. */
  maximized?: boolean;
  onToggleMaximize?: () => void;
}

function MaximizeButton({ maximized, onToggle }: { maximized: boolean; onToggle: () => void }) {
  return (
    <button
      className="button maximize-button"
      data-testid="maximize"
      title={
        maximized ? 'Back to the normal layout (Esc)' : 'Show the comparison on the whole page'
      }
      onClick={onToggle}
    >
      {maximized ? 'Minimize' : 'Maximize'}
    </button>
  );
}

const DETAIL_TABS: readonly DetailTab[] = [
  'response',
  'request',
  'responseHeaders',
  'requestHeaders',
];

function headerBadge(headers: HeaderComparison): string {
  const count = headers.differences;
  return count === 0 ? 'same' : `${count} change${count === 1 ? '' : 's'}`;
}

export function ComparisonView({
  target,
  paired,
  callCounts,
  maximized = false,
  onToggleMaximize,
}: Props) {
  const [tab, setTab] = useState<DetailTab>('response');
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
  const isBodyTab = tab === 'response' || tab === 'request';

  return (
    <div
      className={maximized ? 'comparison maximized' : 'comparison'}
      data-testid="comparison"
      data-maximized={maximized}
    >
      <div className="comparison-header">
        <span
          className={comparison.identical ? 'verdict identical' : 'verdict different'}
          data-testid="verdict"
        >
          {comparison.identical ? 'Identical' : 'Different'}
        </span>
        {!comparison.headersIdentical && (
          <span className="header-flag" data-testid="header-note">
            Headers differ
          </span>
        )}
        {!paired && (
          <span className="hint">Not paired yet. Preview of the two selected requests.</span>
        )}
        <span className="preview-url" title={legacy.request.url}>
          {legacy.request.method} {legacy.request.path}
        </span>
        {onToggleMaximize && <MaximizeButton maximized={maximized} onToggle={onToggleMaximize} />}
      </div>
      <Summary comparison={comparison} callCounts={callCounts} />
      <BodyTabs
        tab={tab}
        onChange={setTab}
        tabs={DETAIL_TABS}
        badges={{
          response: bodyBadge(comparison.responseBody),
          request: bodyBadge(comparison.requestBody),
          responseHeaders: headerBadge(comparison.responseHeaders),
          requestHeaders: headerBadge(comparison.requestHeaders),
        }}
      />
      <div className="comparison-body">
        {isBodyTab ? (
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
              <ChangeList
                body={tab === 'response' ? comparison.responseBody : comparison.requestBody}
              />
            </Panel>
          </Group>
        ) : (
          <HeaderTable
            headers={
              tab === 'responseHeaders' ? comparison.responseHeaders : comparison.requestHeaders
            }
          />
        )}
      </div>
    </div>
  );
}
