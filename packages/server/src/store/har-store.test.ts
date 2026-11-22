import { describe, expect, it } from 'vitest';
import { harToBuffer, makeEntry, makeHar } from '../har/har-builder.test-util.js';
import { parseHar } from '../har/parse-har.js';
import { HarStore } from './har-store.js';

function parsedHar(entryCount = 2) {
  const entries = Array.from({ length: entryCount }, (_, i) =>
    makeEntry({ url: `https://api.example.test/items/${i}` }),
  );
  return parseHar(harToBuffer(makeHar(entries)));
}

describe('HarStore', () => {
  it('stores a HAR and returns its summary', () => {
    const store = new HarStore({ ttlMs: 1000, maxSessions: 5 });
    const stored = store.add('a.har', 123, parsedHar(2));

    expect(stored.meta.fileName).toBe('a.har');
    expect(stored.meta.sizeBytes).toBe(123);
    expect(stored.meta.entryCount).toBe(2);
    expect(stored.meta.skippedCount).toBe(0);
    expect(stored.summaries).toHaveLength(2);

    const response = store.toSummaryResponse(stored);
    expect(response.id).toBe(stored.meta.id);
    expect(response.entries).toHaveLength(2);
    expect(store.get(stored.meta.id)).toBe(stored);
  });

  it('counts skipped entries', () => {
    const store = new HarStore({ ttlMs: 1000, maxSessions: 5 });
    const parsed = parseHar(harToBuffer(makeHar([makeEntry(), makeEntry({ url: 'bad url' })])));
    const stored = store.add('a.har', 1, parsed);
    expect(stored.meta.entryCount).toBe(2);
    expect(stored.meta.skippedCount).toBe(1);
  });

  it('expires a HAR after the time to live', () => {
    let now = 0;
    const store = new HarStore({ ttlMs: 1000, maxSessions: 5, now: () => now });
    const { meta } = store.add('a.har', 1, parsedHar());

    now = 999;
    expect(store.get(meta.id)).toBeDefined();
    now = 999 + 1001;
    expect(store.get(meta.id)).toBeUndefined();
    expect(store.size).toBe(0);
  });

  it('extends the life of a HAR each time it is read', () => {
    let now = 0;
    const store = new HarStore({ ttlMs: 1000, maxSessions: 5, now: () => now });
    const { meta } = store.add('a.har', 1, parsedHar());

    now = 800;
    expect(store.get(meta.id)).toBeDefined();
    now = 1600;
    expect(store.get(meta.id)).toBeDefined();
  });

  it('drops the least recently used HAR when the limit is reached', () => {
    let now = 0;
    const store = new HarStore({ ttlMs: 100000, maxSessions: 2, now: () => now });
    const first = store.add('1.har', 1, parsedHar());
    now = 10;
    const second = store.add('2.har', 1, parsedHar());
    now = 20;
    expect(store.get(first.meta.id)).toBeDefined(); // first is now more recent than second
    now = 30;
    const third = store.add('3.har', 1, parsedHar());

    expect(store.size).toBe(2);
    expect(store.get(second.meta.id)).toBeUndefined();
    expect(store.get(first.meta.id)).toBeDefined();
    expect(store.get(third.meta.id)).toBeDefined();
  });

  it('deletes a HAR', () => {
    const store = new HarStore({ ttlMs: 1000, maxSessions: 5 });
    const { meta } = store.add('a.har', 1, parsedHar());
    expect(store.delete(meta.id)).toBe(true);
    expect(store.get(meta.id)).toBeUndefined();
    expect(store.delete(meta.id)).toBe(false);
  });
});
