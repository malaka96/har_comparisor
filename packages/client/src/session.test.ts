import { describe, expect, it } from 'vitest';
import { EMPTY_FILTER } from './filter';
import { EMPTY_PAIRING, addPair } from './pairing';
import { SessionError, applySession, buildSession, parseSession } from './session';

const legacy = { fileName: 'legacy.har', indexes: [0, 1, 2, 3] };
const next = { fileName: 'new.har', indexes: [0, 1, 2] };

function saved() {
  let pairing = addPair(EMPTY_PAIRING, 2, 1);
  pairing = addPair(pairing, 0, 0);
  const filter = { ...EMPTY_FILTER, text: 'api', status: '5xx' as const };
  return buildSession(legacy, next, pairing, filter, '2026-01-01T00:00:00.000Z');
}

describe('session files', () => {
  it('saves file names, request counts, pairs in legacy order and the filter', () => {
    expect(saved()).toEqual({
      kind: 'har-comparisor-session',
      version: 1,
      savedAt: '2026-01-01T00:00:00.000Z',
      legacy: { fileName: 'legacy.har', requests: 4 },
      new: { fileName: 'new.har', requests: 3 },
      pairs: [
        { legacy: 0, new: 0 },
        { legacy: 2, new: 1 },
      ],
      filter: { ...EMPTY_FILTER, text: 'api', status: '5xx' },
    });
  });

  it('reads back what it saved and restores the pairs without warnings', () => {
    const session = parseSession(JSON.stringify(saved()));
    const applied = applySession(session, legacy, next);
    expect(applied.warnings).toEqual([]);
    expect(applied.restored).toBe(2);
    expect(applied.pairing.pairs.map((p) => [p.legacy, p.new])).toEqual([
      [0, 0],
      [2, 1],
    ]);
    expect(applied.filter.status).toBe('5xx');
  });

  it('warns when the loaded HARs differ, and skips pairs that do not fit', () => {
    const session = parseSession(
      JSON.stringify({
        ...saved(),
        pairs: [
          { legacy: 0, new: 0 },
          { legacy: 9, new: 1 },
          { legacy: 1, new: 0 },
        ],
      }),
    );
    const applied = applySession(session, { fileName: 'other.har', indexes: [0, 1] }, next);
    expect(applied.restored).toBe(1);
    expect(applied.warnings).toEqual([
      'The legacy HAR is other.har, but the session was saved with legacy.har.',
      'The legacy HAR has 2 requests, but the saved one had 4.',
      '2 saved pairs did not fit the loaded HARs and were skipped.',
    ]);
  });

  it('replaces unknown filter values with the defaults', () => {
    const session = parseSession(
      JSON.stringify({ ...saved(), filter: { text: 7, status: 'weird', pair: 'paired' } }),
    );
    expect(session.filter).toEqual({ ...EMPTY_FILTER, pair: 'paired' });
  });

  it.each([
    ['not JSON', '{', 'not valid JSON'],
    ['another file', JSON.stringify({ log: { entries: [] } }), 'not a HAR Comparisor session'],
    ['a newer version', JSON.stringify({ ...saved(), version: 2 }), 'version 2'],
    ['no pairs', JSON.stringify({ ...saved(), pairs: 'x' }), 'no list of pairs'],
    ['a bad pair', JSON.stringify({ ...saved(), pairs: [{ legacy: -1, new: 0 }] }), 'not valid'],
    ['no HAR details', JSON.stringify({ ...saved(), legacy: null }), 'legacy HAR details'],
  ])('rejects %s', (_label, text, message) => {
    expect(() => parseSession(text)).toThrow(SessionError);
    expect(() => parseSession(text)).toThrow(message);
  });
});
