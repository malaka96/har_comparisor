import { describe, expect, it } from 'vitest';
import { diffJson, previewValue } from './json-diff.js';

describe('diffJson', () => {
  it('finds no changes in equal values, whatever the key order', () => {
    expect(diffJson({ a: 1, b: [1, { c: null }] }, { b: [1, { c: null }], a: 1 })).toEqual({
      changes: [],
      truncated: false,
    });
  });

  it('reports a changed value with its path', () => {
    const { changes } = diffJson({ user: { name: 'Ann' } }, { user: { name: 'Bob' } });
    expect(changes).toEqual([
      { path: '$.user.name', kind: 'value', legacy: '"Ann"', new: '"Bob"' },
    ]);
  });

  it('reports type changes, including number vs string and null vs value', () => {
    const { changes } = diffJson({ id: 1, x: null, y: [] }, { id: '1', x: {}, y: {} });
    expect(changes).toEqual([
      { path: '$.id', kind: 'type', legacy: '1', new: '"1"' },
      { path: '$.x', kind: 'type', legacy: 'null', new: '{0 keys}' },
      { path: '$.y', kind: 'type', legacy: '[0 items]', new: '{0 keys}' },
    ]);
  });

  it('reports added and removed fields, keeping missing and null apart', () => {
    const { changes } = diffJson({ a: 1, gone: null }, { a: 1, extra: true });
    expect(changes).toEqual([
      { path: '$.gone', kind: 'removed', legacy: 'null' },
      { path: '$.extra', kind: 'added', new: 'true' },
    ]);
  });

  it('compares arrays by position and reports length differences', () => {
    const { changes } = diffJson([1, 2, 3], [1, 5]);
    expect(changes).toEqual([
      { path: '$[1]', kind: 'value', legacy: '2', new: '5' },
      { path: '$[2]', kind: 'removed', legacy: '3' },
    ]);
    expect(diffJson([], [{ a: 1 }]).changes).toEqual([
      { path: '$[0]', kind: 'added', new: '{1 keys}' },
    ]);
  });

  it('reports an array with the same items in another order as one order change', () => {
    expect(diffJson({ tags: ['a', 'b', 'c'] }, { tags: ['c', 'a', 'b'] }).changes).toEqual([
      { path: '$.tags', kind: 'order', legacy: '[3 items]', new: '[3 items]' },
    ]);
  });

  it('treats objects with the same content as the same item when checking order', () => {
    const a = [{ id: 1, n: 'x' }, { id: 2 }];
    const b = [{ id: 2 }, { n: 'x', id: 1 }];
    expect(diffJson(a, b).changes).toEqual([
      { path: '$', kind: 'order', legacy: '[2 items]', new: '[2 items]' },
    ]);
  });

  it('counts repeated items, so a different mix is not just an order change', () => {
    const { changes } = diffJson([1, 1, 2], [1, 2, 2]);
    expect(changes).toEqual([{ path: '$[1]', kind: 'value', legacy: '1', new: '2' }]);
  });

  it('quotes keys that are not plain identifiers', () => {
    const { changes } = diffJson({ 'first-name': 'a', '0': 1 }, { 'first-name': 'b', '0': 2 });
    expect(changes.map((c) => c.path).sort()).toEqual(['$["0"]', '$["first-name"]']);
  });

  it('handles top-level scalars', () => {
    expect(diffJson('a', 'a').changes).toEqual([]);
    expect(diffJson(true, false).changes).toEqual([
      { path: '$', kind: 'value', legacy: 'true', new: 'false' },
    ]);
  });

  it('stops after the change limit and says so', () => {
    const a = Array.from({ length: 50 }, (_, i) => i);
    const b = a.map((n) => n + 1);
    const result = diffJson(a, b, { maxChanges: 10 });
    expect(result.changes).toHaveLength(10);
    expect(result.truncated).toBe(true);
  });

  it('is fast enough on a large body', () => {
    const make = (shift: number) =>
      Array.from({ length: 20000 }, (_, i) => ({ id: i, name: `item ${i}`, price: i + shift }));
    const started = performance.now();
    const result = diffJson(make(0), make(0));
    expect(result.changes).toEqual([]);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe('previewValue', () => {
  it('shortens long strings', () => {
    const preview = previewValue('x'.repeat(500));
    expect(preview.length).toBeLessThanOrEqual(123);
    expect(preview.endsWith('...')).toBe(true);
  });
});
