export type BodyTab = 'response' | 'request';

interface Props {
  tab: BodyTab;
  onChange: (tab: BodyTab) => void;
  /** Optional marker after each label, for example a change count. */
  badges?: Partial<Record<BodyTab, string>>;
}

const LABELS: Record<BodyTab, string> = {
  response: 'Response body',
  request: 'Request body',
};

export function BodyTabs({ tab, onChange, badges }: Props) {
  return (
    <div className="tabs" role="tablist">
      {(['response', 'request'] as const).map((name) => (
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
