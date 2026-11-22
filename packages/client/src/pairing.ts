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

/** Entry indexes that are not part of any pair. */
export function unpaired(indexes: number[], state: PairingState, side: 'legacy' | 'new'): number[] {
  const used = new Set(state.pairs.map((p) => (side === 'legacy' ? p.legacy : p.new)));
  return indexes.filter((i) => !used.has(i));
}
