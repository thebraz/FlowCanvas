import { BaseEdge, getSmoothStepPath, type Edge, type EdgeProps } from '@xyflow/react';
import { useAppStore } from '../../state/context';
import type { SourcePort } from '../../contracts/workflow';
export type RuntimeFlowEdge = Edge<{ readonly port: SourcePort }, 'runtime'>;
export function RuntimeEdge(props: EdgeProps<RuntimeFlowEdge>) {
  const record = useAppStore((s) => s.runtime.records.get(props.source));
  const target = useAppStore((s) => s.runtime.records.get(props.target)?.disposition);
  const port = props.data?.port ?? 'out';
  const emitted = record?.outputPayloadIds?.[port] !== undefined;
  const inactive = record?.disposition === 'completed' && !emitted;
  const [path, labelX, labelY] = getSmoothStepPath(props);
  const status = emitted ? 'Executed path' : inactive ? 'Inactive branch' : 'Pending path';
  return (
    <g role="img" aria-label={status} data-path-status={status}>
      <BaseEdge
        id={props.id}
        path={path}
        labelX={labelX}
        labelY={labelY}
        label={props.label}
        {...(props.markerEnd ? { markerEnd: props.markerEnd } : {})}
        interactionWidth={props.interactionWidth ?? 12}
        style={{
          ...props.style,
          stroke: emitted
            ? target === 'failed'
              ? 'var(--danger)'
              : 'var(--success)'
            : 'var(--control-border)',
          strokeDasharray: inactive ? '6 4' : undefined,
          strokeWidth: props.selected ? 3 : 2,
        }}
      />
    </g>
  );
}
