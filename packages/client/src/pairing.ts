/** A legacy entry index paired with a new entry index. */
export interface Pair {
  id: number;
  legacy: number;
  new: number;
}

export interface PairingState {
  pairs: Pair[];
  nextId: number;
}

export const EMPTY_PAIRING: PairingState = { pairs: [], nextId: 1 };

/**
 * Pairs two entries. Any existing pair that uses either entry is released first,
 * so each entry belongs to at most one pair.
 */
export function addPair(state: PairingState, legacy: number, next: number): PairingState {
  const kept = state.pairs.filter((p) => p.legacy !== legacy && p.new !== next);
  return {
    pairs: [...kept, { id: state.nextId, legacy, new: next }],
    nextId: state.nextId + 1,
  };
}

export function removePair(state: PairingState, id: number): PairingState {
  return { ...state, pairs: state.pairs.filter((p) => p.id !== id) };
}

export function pairOfLegacy(state: PairingState, index: number): Pair | undefined {
  return state.pairs.find((p) => p.legacy === index);
}

export function pairOfNew(state: PairingState, index: number): Pair | undefined {
  return state.pairs.find((p) => p.new === index);
}

/** Position of a pair in display order (1-based), sorted by the legacy index. */
export function pairNumbers(state: PairingState): Map<number, number> {
  const sorted = [...state.pairs].sort((a, b) => a.legacy - b.legacy || a.new - b.new);
  return new Map(sorted.map((p, i) => [p.id, i + 1]));
}

/**
 * Ids of pairs whose call order differs between the two HARs.
 * Pairs are taken in legacy order; the longest run whose new indexes also increase is
 * "in order", and every other pair is flagged. This flags the fewest calls that moved.
 */
export function outOfOrderPairs(state: PairingState): Set<number> {
  const pairs = [...state.pairs].sort((a, b) => a.legacy - b.legacy);
  const n = pairs.length;
  if (n < 2) return new Set();

  // Longest increasing subsequence of new indexes, O(n log n), with back links.
  const tails: number[] = []; // position in `pairs` of the last item of each run length
  const previous = new Array<number>(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const value = pairs[i]!.new;
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (pairs[tails[mid]!]!.new < value) low = mid + 1;
      else high = mid;
    }
    if (low > 0) previous[i] = tails[low - 1]!;
    tails[low] = i;
  }
  const inOrder = new Set<number>();
  for (let i = tails[tails.length - 1]!; i !== -1; i = previous[i]!) inOrder.add(pairs[i]!.id);
  return new Set(pairs.filter((p) => !inOrder.has(p.id)).map((p) => p.id));
}

/** Entry indexes that are not part of any pair. */
export function unpaired(indexes: number[], state: PairingState, side: 'legacy' | 'new'): number[] {
  const used = new Set(state.pairs.map((p) => (side === 'legacy' ? p.legacy : p.new)));
  return indexes.filter((i) => !used.has(i));
}
