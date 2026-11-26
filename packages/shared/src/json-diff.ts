/** One difference between two JSON values. */
export interface JsonChange {
  /** Location of the change, for example `$.items[2].price`. */
  path: string;
  /**
   * - `value`: same type, different value
   * - `type`: different JSON types (for example string vs number, or null vs object)
   * - `added`: present only in the new value
   * - `removed`: present only in the legacy value
   * - `order`: an array with the same items in a different order
   */
  kind: 'value' | 'type' | 'added' | 'removed' | 'order';
  /** Short, readable form of the legacy value. Absent for `added`. */
  legacy?: string;
  /** Short, readable form of the new value. Absent for `removed`. */
  new?: string;
}

export interface JsonDiffResult {
  changes: JsonChange[];
  /** True when more changes existed than `maxChanges`. */
  truncated: boolean;
}

export interface JsonDiffOptions {
  /** Most changes to report. Defaults to 1000. */
  maxChanges?: number;
}

export type JsonType = 'null' | 'array' | 'object' | 'string' | 'number' | 'boolean';

export function jsonType(value: unknown): JsonType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') return type;
  return 'object';
}

const PREVIEW_LENGTH = 120;

/** A short, single-line form of a JSON value for display. */
export function previewValue(value: unknown): string {
  let text: string;
  const type = jsonType(value);
  if (type === 'array') text = `[${(value as unknown[]).length} items]`;
  else if (type === 'object') text = `{${Object.keys(value as object).length} keys}`;
  else text = JSON.stringify(value);
  return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}...` : text;
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function childPath(path: string, key: string): string {
  return IDENTIFIER.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
}

class Collector {
  readonly changes: JsonChange[] = [];
  truncated = false;

  constructor(private readonly max: number) {}

  get full(): boolean {
    return this.truncated;
  }

  add(change: JsonChange): void {
    if (this.changes.length >= this.max) {
      this.truncated = true;
      return;
    }
    this.changes.push(change);
  }
}

/** JSON text with object keys sorted, so equal values give equal text whatever the key order. */
function canonical(value: unknown): string {
  const type = jsonType(value);
  if (type === 'array') return `[${(value as unknown[]).map(canonical).join(',')}]`;
  if (type === 'object') {
    const object = value as Record<string, unknown>;
    const keys = Object.keys(object).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(object[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * True when both arrays hold exactly the same items (counting repeats), but not all in the
 * same positions. Such arrays are reported as one "order" change instead of many value changes.
 */
function isReordered(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length || a.length < 2) return false;
  const left = a.map(canonical);
  const right = b.map(canonical);
  if (left.every((item, i) => item === right[i])) return false;
  const counts = new Map<string, number>();
  for (const item of left) counts.set(item, (counts.get(item) ?? 0) + 1);
  for (const item of right) {
    const count = counts.get(item);
    if (!count) return false;
    counts.set(item, count - 1);
  }
  return true;
}

function walk(legacy: unknown, next: unknown, path: string, out: Collector): void {
  if (out.full) return;
  const legacyType = jsonType(legacy);
  const nextType = jsonType(next);

  if (legacyType !== nextType) {
    out.add({ path, kind: 'type', legacy: previewValue(legacy), new: previewValue(next) });
    return;
  }

  if (legacyType === 'array') {
    const a = legacy as unknown[];
    const b = next as unknown[];
    if (isReordered(a, b)) {
      out.add({
        path,
        kind: 'order',
        legacy: previewValue(a),
        new: previewValue(b),
      });
      return;
    }
    const shared = Math.min(a.length, b.length);
    for (let i = 0; i < shared; i++) walk(a[i], b[i], `${path}[${i}]`, out);
    for (let i = shared; i < a.length; i++) {
      out.add({ path: `${path}[${i}]`, kind: 'removed', legacy: previewValue(a[i]) });
    }
    for (let i = shared; i < b.length; i++) {
      out.add({ path: `${path}[${i}]`, kind: 'added', new: previewValue(b[i]) });
    }
    return;
  }

  if (legacyType === 'object') {
    const a = legacy as Record<string, unknown>;
    const b = next as Record<string, unknown>;
    for (const key of Object.keys(a)) {
      if (Object.hasOwn(b, key)) walk(a[key], b[key], childPath(path, key), out);
      else out.add({ path: childPath(path, key), kind: 'removed', legacy: previewValue(a[key]) });
    }
    for (const key of Object.keys(b)) {
      if (!Object.hasOwn(a, key)) {
        out.add({ path: childPath(path, key), kind: 'added', new: previewValue(b[key]) });
      }
    }
    return;
  }

  if (legacy !== next) {
    out.add({ path, kind: 'value', legacy: previewValue(legacy), new: previewValue(next) });
  }
}

/**
 * Compares two parsed JSON values and lists their differences.
 * Arrays are compared by position. Key order is ignored.
 */
export function diffJson(
  legacy: unknown,
  next: unknown,
  options: JsonDiffOptions = {},
): JsonDiffResult {
  const out = new Collector(options.maxChanges ?? 1000);
  walk(legacy, next, '$', out);
  return { changes: out.changes, truncated: out.truncated };
}
