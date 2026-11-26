import { describe, expect, it } from 'vitest';
import {
  EMPTY_PAIRING,
  addPair,
  outOfOrderPairs,
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

  it('flags no pair when the call order is the same', () => {
    let state = addPair(EMPTY_PAIRING, 0, 0);
    state = addPair(state, 1, 2);
    state = addPair(state, 3, 5);
    expect(outOfOrderPairs(state)).toEqual(new Set());
  });

  it('flags the fewest pairs that moved (F13)', () => {
    // Legacy order 0,1,2,3,4. The new app calls legacy 3 first.
    let state = EMPTY_PAIRING;
    state = addPair(state, 0, 1); // id 1
    state = addPair(state, 1, 2); // id 2
    state = addPair(state, 2, 3); // id 3
    state = addPair(state, 3, 0); // id 4, moved to the front
    state = addPair(state, 4, 4); // id 5
    expect(outOfOrderPairs(state)).toEqual(new Set([4]));
  });

  it('flags one of two swapped calls', () => {
    let state = addPair(EMPTY_PAIRING, 2, 3);
    state = addPair(state, 3, 2);
    expect(outOfOrderPairs(state).size).toBe(1);
  });

  it('lists unpaired entries as missing or extra (A7, A8)', () => {
    const state = addPair(addPair(EMPTY_PAIRING, 0, 0), 1, 2);
    expect(unpaired([0, 1, 2], state, 'legacy')).toEqual([2]);
    expect(unpaired([0, 1, 2, 3], state, 'new')).toEqual([1, 3]);
  });
});
