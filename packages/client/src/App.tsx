import { useEffect, useMemo, useRef, useState } from 'react';
import type { HarSummaryResponse } from '@har-comparisor/shared';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { fetchComparisonSummary } from './api';
import { ComparisonView } from './components/ComparisonView';
import { EntryPreview } from './components/EntryPreview';
import type { RowMarker } from './components/EntryTable';
import { HarPane } from './components/HarPane';
import {
  EMPTY_PAIRING,
  addPair,
  pairNumbers,
  pairOfLegacy,
  pairOfNew,
  removePair,
  unpaired,
  type PairingState,
} from './pairing';

type PairStatus = 'identical' | 'different' | 'error';

interface Selection {
  legacy?: number;
  new?: number;
}

const pairKey = (legacyHarId: string, newHarId: string, legacy: number, next: number) =>
  `${legacyHarId}:${newHarId}:${legacy}:${next}`;

export function App() {
  const [legacyHar, setLegacyHar] = useState<HarSummaryResponse>();
  const [newHar, setNewHar] = useState<HarSummaryResponse>();
  const [pairing, setPairing] = useState<PairingState>(EMPTY_PAIRING);
  const [selection, setSelection] = useState<Selection>({});
  const [statuses, setStatuses] = useState<Map<string, PairStatus>>(new Map());

  function resetPairs() {
    setPairing(EMPTY_PAIRING);
    setSelection({});
  }

  // Load the comparison result of each new pair, for the green or orange marker.
  // Keys include both HAR ids, so a late answer for a replaced HAR is never shown.
  const requested = useRef(new Set<string>());
  useEffect(() => {
    if (!legacyHar || !newHar) return;
    for (const pair of pairing.pairs) {
      const key = pairKey(legacyHar.id, newHar.id, pair.legacy, pair.new);
      if (requested.current.has(key)) continue;
      requested.current.add(key);
      fetchComparisonSummary({
        legacyHarId: legacyHar.id,
        legacyIndex: pair.legacy,
        newHarId: newHar.id,
        newIndex: pair.new,
      })
        .then(({ comparison }): PairStatus => (comparison.identical ? 'identical' : 'different'))
        .catch((): PairStatus => 'error')
        .then((status) => setStatuses((old) => new Map(old).set(key, status)));
    }
  }, [pairing, legacyHar, newHar]);

  const statusOf = (legacy: number, next: number): PairStatus | undefined =>
    legacyHar && newHar ? statuses.get(pairKey(legacyHar.id, newHar.id, legacy, next)) : undefined;

  const numbers = useMemo(() => pairNumbers(pairing), [pairing]);

  const markers = (() => {
    const legacy = new Map<number, RowMarker>();
    const next = new Map<number, RowMarker>();
    for (const pair of pairing.pairs) {
      const status = statusOf(pair.legacy, pair.new);
      const tone = status ?? 'pending';
      const label = `#${numbers.get(pair.id)}`;
      const title =
        status === 'identical'
          ? 'Paired, identical'
          : status === 'different'
            ? 'Paired, has differences'
            : status === 'error'
              ? 'Paired, comparison failed'
              : 'Paired, comparing...';
      legacy.set(pair.legacy, { label, tone, title: `${title} (new #${pair.new})` });
      next.set(pair.new, { label, tone, title: `${title} (legacy #${pair.legacy})` });
    }
    if (legacyHar && newHar) {
      const legacyIndexes = legacyHar.entries.map((e) => e.index);
      const newIndexes = newHar.entries.map((e) => e.index);
      for (const i of unpaired(legacyIndexes, pairing, 'legacy')) {
        legacy.set(i, { label: 'missing', tone: 'missing', title: 'Not paired: only in legacy' });
      }
      for (const i of unpaired(newIndexes, pairing, 'new')) {
        next.set(i, { label: 'extra', tone: 'extra', title: 'Not paired: only in new' });
      }
    }
    return { legacy, next };
  })();

  const counts = (() => {
    let identical = 0;
    let different = 0;
    for (const pair of pairing.pairs) {
      const status = statusOf(pair.legacy, pair.new);
      if (status === 'identical') identical++;
      else if (status === 'different') different++;
    }
    return {
      pairs: pairing.pairs.length,
      identical,
      different,
      missing: legacyHar ? legacyHar.entries.length - pairing.pairs.length : 0,
      extra: newHar ? newHar.entries.length - pairing.pairs.length : 0,
    };
  })();

  // Clicking a paired request selects its partner too. Clicking an unpaired request keeps
  // the other side's selection, so the two can be compared and (re-)paired.
  function selectLegacy(index: number) {
    const pair = pairOfLegacy(pairing, index);
    if (pair) setSelection({ legacy: index, new: pair.new });
    else setSelection((old) => ({ ...old, legacy: index }));
  }

  function selectNew(index: number) {
    const pair = pairOfNew(pairing, index);
    if (pair) setSelection({ legacy: pair.legacy, new: index });
    else setSelection((old) => ({ ...old, new: index }));
  }

  const selectedPair =
    selection.legacy !== undefined && selection.new !== undefined
      ? pairing.pairs.find((p) => p.legacy === selection.legacy && p.new === selection.new)
      : undefined;
  const canPair =
    legacyHar !== undefined &&
    newHar !== undefined &&
    selection.legacy !== undefined &&
    selection.new !== undefined &&
    !selectedPair;

  function pairSelected() {
    if (!canPair) return;
    setPairing((old) => addPair(old, selection.legacy as number, selection.new as number));
  }

  function unpairSelected() {
    if (selectedPair) setPairing((old) => removePair(old, selectedPair.id));
  }

  let bottom;
  if (legacyHar && newHar && selection.legacy !== undefined && selection.new !== undefined) {
    bottom = (
      <ComparisonView
        target={{
          legacyHarId: legacyHar.id,
          legacyIndex: selection.legacy,
          newHarId: newHar.id,
          newIndex: selection.new,
        }}
        paired={selectedPair !== undefined}
      />
    );
  } else if (legacyHar && selection.legacy !== undefined) {
    bottom = <EntryPreview harId={legacyHar.id} index={selection.legacy} label="Legacy" />;
  } else if (newHar && selection.new !== undefined) {
    bottom = <EntryPreview harId={newHar.id} index={selection.new} label="New" />;
  } else {
    bottom = (
      <div className="body-message">
        Select a legacy request and a new request to compare them, then pair them.
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>HAR Comparisor</h1>
        <div className="counts" data-testid="counts">
          <span>
            Pairs: <strong>{counts.pairs}</strong>
          </span>
          <span className="count identical">Identical: {counts.identical}</span>
          <span className="count different">Different: {counts.different}</span>
          <span className="count missing">Missing in new: {counts.missing}</span>
          <span className="count extra">Extra in new: {counts.extra}</span>
        </div>
        <div className="actions">
          <button className="button primary" disabled={!canPair} onClick={pairSelected}>
            Pair selected
          </button>
          <button className="button" disabled={!selectedPair} onClick={unpairSelected}>
            Unpair
          </button>
        </div>
      </header>
      <main className="app-main">
        <Group orientation="vertical">
          <Panel id="lists" defaultSize="50%" minSize="15%">
            <Group orientation="horizontal">
              <Panel id="legacy" minSize="20%">
                <HarPane
                  side="legacy"
                  title="Legacy"
                  har={legacyHar}
                  onLoaded={(har) => {
                    setLegacyHar(har);
                    resetPairs();
                  }}
                  selectedIndex={selection.legacy}
                  onSelect={selectLegacy}
                  markers={markers.legacy}
                />
              </Panel>
              <Separator className="separator vertical" />
              <Panel id="new" minSize="20%">
                <HarPane
                  side="new"
                  title="New"
                  har={newHar}
                  onLoaded={(har) => {
                    setNewHar(har);
                    resetPairs();
                  }}
                  selectedIndex={selection.new}
                  onSelect={selectNew}
                  markers={markers.next}
                />
              </Panel>
            </Group>
          </Panel>
          <Separator className="separator horizontal" />
          <Panel id="detail" minSize="15%">
            {bottom}
          </Panel>
        </Group>
      </main>
    </div>
  );
}
