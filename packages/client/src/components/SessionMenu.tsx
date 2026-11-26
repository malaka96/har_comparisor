import { useRef } from 'react';

export interface SessionNotice {
  tone: 'ok' | 'error';
  message: string;
  warnings: string[];
}

interface Props {
  /** True when both HARs are loaded, so there is a session to save or to restore onto. */
  ready: boolean;
  onSave: () => void;
  onLoad: (file: File) => void;
}

/** The result of loading a session, shown as a banner under the header until dismissed. */
export function SessionNoticeBanner({
  notice,
  onDismiss,
}: {
  notice: SessionNotice;
  onDismiss: () => void;
}) {
  return (
    <div
      className={notice.tone === 'error' ? 'session-notice error' : 'session-notice'}
      role={notice.tone === 'error' ? 'alert' : 'status'}
      data-testid="session-notice"
    >
      <span>{notice.message}</span>
      {notice.warnings.length > 0 && (
        <ul>
          {notice.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      <button aria-label="Dismiss" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}

/** Saves the pairs and filter to a JSON file, and loads them back onto the same HARs. */
export function SessionMenu({ ready, onSave, onLoad }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const why = ready ? undefined : 'Load both HARs first';
  return (
    <div className="session" data-testid="session">
      <button className="button" disabled={!ready} title={why} onClick={onSave}>
        Save session
      </button>
      <button
        className="button"
        disabled={!ready}
        title={why ?? 'Restore pairs and filters saved for these HARs'}
        onClick={() => input.current?.click()}
      >
        Load session
      </button>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        aria-label="Session file"
        data-testid="file-session"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onLoad(file);
        }}
      />
    </div>
  );
}
