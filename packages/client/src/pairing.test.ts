import { describe, expect, it } from 'vitest';
import {
  EMPTY_PAIRING,
  addPair,
  pairNumbers,
  pairOfLegacy,
  pairOfNew,
  removePair,
  unpaired,
} from './pairing';

describe('pairing', () => {
  it('adds a pair', () => {
    const state = addPair(EMPTY_PAIRING, 0, 1);
    expect(state.pairs).toEqual([{ id: 1, legacy: 0, new: 1 }]);
    expect(pairOfLegacy(state, 0)?.new).toBe(1);
    expect(pairOfNew(state, 1)?.legacy).toBe(0);
  });

  it('releases the old pair when an entry is paired again (A4)', () => {
    let state = addPair(EMPTY_PAIRING, 0, 0);
    state = addPair(state, 1, 1);
    state = addPair(state, 0, 1); // L0 moves to N1; L0-N0 and L1-N1 are both released
    expect(state.pairs).toEqual([{ id: 3, legacy: 0, new: 1 }]);
  });

  it('unpairs and pairs again', () => {
    let state = addPair(EMPTY_PAIRING, 0, 0);
    state = removePair(state, 1);
    expect(state.pairs).toEqual([]);
    state = addPair(state, 0, 2);
    expect(pairOfLegacy(state, 0)?.new).toBe(2);
  });

  it('does not depend on order (A6)', () => {
    let state = addPair(EMPTY_PAIRING, 26, 27);
    state = addPair(state, 27, 26);
    expect(pairOfLegacy(state, 26)?.new).toBe(27);
    expect(pairOfLegacy(state, 27)?.new).toBe(26);
  });

  it('numbers pairs by legacy position', () => {
    let state = addPair(EMPTY_PAIRING, 5, 5);
    state = addPair(state, 1, 1);
    const numbers = pairNumbers(state);
    expect(numbers.get(2)).toBe(1);
    expect(numbers.get(1)).toBe(2);
  });

  it('lists unpaired entries as missing or extra (A7, A8)', () => {
    const state = addPair(addPair(EMPTY_PAIRING, 0, 0), 1, 2);
    expect(unpaired([0, 1, 2], state, 'legacy')).toEqual([2]);
    expect(unpaired([0, 1, 2, 3], state, 'new')).toEqual([1, 3]);
  });
});
