import { useAppStore } from '../../state/context';
export function NodeStatus({ nodeId }: { readonly nodeId: string }) {
  const record = useAppStore((s) => s.runtime.records.get(nodeId));
  const isOutput = useAppStore((s) => s.indexes.nodeById.get(nodeId)?.type === 'output');
  if (!record) return null;
  return (
    <span
      className={`runtime-badge runtime-${record.disposition}`}
      data-runtime={record.disposition}
    >
      {record.disposition}
      {isOutput && record.disposition === 'completed' ? ' · Final result' : ''}
      {record.durationMs === undefined ? '' : ` · ${record.durationMs.toFixed(2)} ms`}
      {record.skipReason ? ` · ${record.skipReason}` : ''}
      {record.errorCode ? ` · ${record.errorCode}` : ''}
      {record.outputPayloadIds?.true ? ' · True' : record.outputPayloadIds?.false ? ' · False' : ''}
    </span>
  );
}
