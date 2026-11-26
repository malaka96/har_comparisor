import { EMPTY_FILTER, isFilterActive, type FilterState } from '../filter';

interface Props {
  filter: FilterState;
  onChange: (filter: FilterState) => void;
  /** HTTP methods found in the loaded HARs. */
  methods: string[];
  /** Browser resource types found in the loaded HARs. */
  types: string[];
}

/** One filter for both request lists. */
export function FilterBar({ filter, onChange, methods, types }: Props) {
  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    onChange({ ...filter, [key]: value });

  return (
    <div className="filter-bar" data-testid="filter-bar" role="search">
      <input
        type="search"
        className="filter-text"
        placeholder="Search URLs"
        aria-label="Search URLs"
        value={filter.text}
        onChange={(event) => set('text', event.target.value)}
      />
      <label>
        Method
        <select
          aria-label="Method"
          value={filter.method}
          onChange={(event) => set('method', event.target.value)}
        >
          <option value="all">All</option>
          {methods.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select
          aria-label="Status"
          value={filter.status}
          onChange={(event) => set('status', event.target.value as FilterState['status'])}
        >
          <option value="all">All</option>
          <option value="2xx">2xx success</option>
          <option value="3xx">3xx redirect</option>
          <option value="4xx">4xx client error</option>
          <option value="5xx">5xx server error</option>
          <option value="failed">Failed (no response)</option>
        </select>
      </label>
      <label>
        Type
        <select
          aria-label="Type"
          value={filter.type}
          onChange={(event) => set('type', event.target.value)}
        >
          <option value="all">All</option>
          <option value="api">API calls (XHR and fetch)</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label>
        Pair
        <select
          aria-label="Pair"
          value={filter.pair}
          onChange={(event) => set('pair', event.target.value as FilterState['pair'])}
        >
          <option value="all">All</option>
          <option value="unpaired">Not paired (missing or extra)</option>
          <option value="paired">Paired</option>
          <option value="different">Paired, different</option>
          <option value="identical">Paired, identical</option>
        </select>
      </label>
      <button
        className="button"
        disabled={!isFilterActive(filter)}
        onClick={() => onChange(EMPTY_FILTER)}
      >
        Clear filters
      </button>
    </div>
  );
}
