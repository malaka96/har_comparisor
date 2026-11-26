import type { HeaderComparison } from '@har-comparisor/shared';

const KIND_LABELS = {
  same: 'same',
  changed: 'changed',
  added: 'only in new',
  removed: 'only in legacy',
} as const;

/** All headers of both sides, side by side, with differing rows highlighted. */
export function HeaderTable({ headers }: { headers: HeaderComparison }) {
  if (headers.rows.length === 0) {
    return <div className="body-message">No headers were recorded.</div>;
  }
  const ignoredDiffering = headers.rows.filter((r) => r.ignored && r.kind !== 'same').length;
  return (
    <div className="scroll header-table" data-testid="header-table">
      <p className="note">
        {headers.differences === 0
          ? 'No header differences.'
          : `${headers.differences} header difference${headers.differences === 1 ? '' : 's'}.`}
        {ignoredDiffering > 0 &&
          ` ${ignoredDiffering} more in headers that are ignored by default (greyed out), because they change on every request.`}
      </p>
      <table className="changes headers">
        <colgroup>
          <col className="header-name" />
          <col className="header-kind" />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>Header</th>
            <th>Change</th>
            <th>Legacy</th>
            <th>New</th>
          </tr>
        </thead>
        <tbody>
          {headers.rows.map((row) => {
            const classes = ['header-row', row.kind];
            if (row.ignored) classes.push('ignored');
            return (
              <tr
                key={row.name.toLowerCase()}
                className={classes.join(' ')}
                data-header={row.name.toLowerCase()}
              >
                <td title={row.name}>{row.name}</td>
                <td>
                  {row.ignored && row.kind !== 'same' ? 'ignored' : KIND_LABELS[row.kind]}
                  {row.caseDiffers && (
                    <span title="The name is spelled with different letter case"> (case)</span>
                  )}
                </td>
                <td title={row.legacy}>{row.legacy ?? ''}</td>
                <td title={row.new}>{row.new ?? ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
