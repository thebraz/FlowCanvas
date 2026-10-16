import type { JsonValue, WorkflowDocument } from '../../contracts/workflow';

export function compareAscii(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
export function compareCodePoints(a: string, b: string): number {
  if (a === b) return 0;
  let left = 0,
    right = 0;
  while (left < a.length && right < b.length) {
    const first = a.codePointAt(left) ?? 0,
      second = b.codePointAt(right) ?? 0;
    const difference = first - second;
    if (difference !== 0) return difference;
    left += first > 0xffff ? 2 : 1;
    right += second > 0xffff ? 2 : 1;
  }
  let remaining = 0;
  while (left < a.length) {
    left += (a.codePointAt(left) ?? 0) > 0xffff ? 2 : 1;
    remaining++;
  }
  while (right < b.length) {
    right += (b.codePointAt(right) ?? 0) > 0xffff ? 2 : 1;
    remaining--;
  }
  return remaining;
}
export function utf8Bytes(value: string): number {
  // DATA_CONTRACT: ASCII code units are UTF-8 bytes; avoid repeated scalar scans of large JSON.
  if (!/[^\p{ASCII}]/u.test(value)) return value.length;
  let bytes = 0;
  for (let index = 0; index < value.length;) {
    const cp = value.codePointAt(index) ?? 0;
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
    index += cp > 0xffff ? 2 : 1;
  }
  return bytes;
}
// Trusted, bounded JSON only. Public unknown inputs use validation/codec.ts.
export function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const pairs = Object.entries(value).sort(([a], [b]) => compareCodePoints(a, b));
  return `{${pairs.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(',')}}`;
}
export function canonicalDocument(document: WorkflowDocument): string {
  // Preserve field ownership without converting the document into renderer state.
  const json: JsonValue = {
    schemaVersion: document.schemaVersion,
    id: document.id,
    metadata: { ...document.metadata },
    viewport: { ...document.viewport },
    nodes: [...document.nodes]
      .sort((a, b) => compareAscii(a.id, b.id))
      .map((node) => ({
        id: node.id,
        type: node.type,
        label: node.label,
        position: { ...node.position },
        config: node.config === null ? null : { ...node.config },
        ...(node.presentation === undefined ? {} : { presentation: { ...node.presentation } }),
      })),
    edges: [...document.edges]
      .sort((a, b) => compareAscii(a.id, b.id))
      .map((edge) => ({
        id: edge.id,
        source: { ...edge.source },
        target: { ...edge.target },
      })),
  };
  return canonicalJson(json);
}
