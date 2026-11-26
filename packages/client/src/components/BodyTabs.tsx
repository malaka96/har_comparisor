export type BodyTab = 'response' | 'request';
export type DetailTab = BodyTab | 'responseHeaders' | 'requestHeaders';

const LABELS: Record<DetailTab, string> = {
  response: 'Response body',
  request: 'Request body',
  responseHeaders: 'Response headers',
  requestHeaders: 'Request headers',
};

const BODY_TABS: readonly BodyTab[] = ['response', 'request'];

interface Props<T extends DetailTab> {
  tab: T;
  onChange: (tab: T) => void;
  /** Tabs to show, in order. Defaults to the two body tabs. */
  tabs?: readonly T[];
  /** Optional marker after each label, for example a change count. */
  badges?: Partial<Record<T, string>>;
}

export function BodyTabs<T extends DetailTab>({ tab, onChange, tabs, badges }: Props<T>) {
  const list = tabs ?? (BODY_TABS as readonly T[]);
  return (
    <div className="tabs" role="tablist">
      {list.map((name) => (
        <button
          key={name}
          role="tab"
          aria-selected={tab === name}
          className={tab === name ? 'tab active' : 'tab'}
          onClick={() => onChange(name)}
        >
          {LABELS[name]}
          {badges?.[name] && <span className="tab-badge">{badges[name]}</span>}
        </button>
      ))}
    </div>
  );
}
