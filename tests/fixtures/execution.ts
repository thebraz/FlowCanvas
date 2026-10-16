import { expect } from 'vitest';
import { sampleId } from '../../src/application/sample';
import { createSample } from '../../src/application/sample';
import { compile } from '../../src/engine/compile';
import { ExecutionEngine } from '../../src/engine/scheduler';
import type { NodeHandler } from '../../src/engine/nodes';
import type { WorkerMessage } from '../../src/contracts/worker';
import type { WorkflowDocument, JsonObject, WorkflowNode } from '../../src/contracts/workflow';
import { emptyDocument, link } from './graphs';
import { defaultNode } from '../../src/domain/graph/commands';
export const identity = {
  protocolVersion: 1 as const,
  sessionId: sampleId(9000),
  semanticRevision: 0,
  runId: sampleId(9001),
};
export function node(type: WorkflowNode['type'], id: number): WorkflowNode {
  return defaultNode(type, sampleId(id), { x: 0, y: 0 });
}
export function simpleGraph(payload: JsonObject = { a: 1 }): WorkflowDocument {
  return {
    ...emptyDocument(),
    nodes: [
      { ...node('manualTrigger', 2), type: 'manualTrigger', config: { payload } },
      { ...node('output', 3), type: 'output', config: { name: 'Result' } },
    ],
    edges: [link(sampleId(2), sampleId(3), 1000)],
  };
}
export function harness(
  document = createSample(),
  options: {
    readonly handler?: NodeHandler;
    readonly onMessage?: (message: WorkerMessage, engine: ExecutionEngine) => void;
    readonly now?: () => number;
  } = {},
) {
  const compiled = compile(document);
  expect(compiled.ok).toBe(true);
  if (!compiled.ok) throw new Error('Fixture not ready');
  const messages: WorkerMessage[] = [];
  let tick = 0;
  const engine = new ExecutionEngine(identity, compiled.value, {
    now: options.now ?? (() => ++tick / 10),
    yieldControl: () => Promise.resolve(),
    publish: (message) => {
      messages.push(message);
      options.onMessage?.(message, engine);
    },
    ...(options.handler ? { handler: options.handler } : {}),
  });
  engine.ready(0);
  return {
    engine,
    messages,
    begin: (mode: 'run' | 'pauseBeforeFirst' = 'run') =>
      engine.control({ kind: 'begin', requestId: sampleId(9010), mode }),
  };
}
export async function settle(predicate: () => boolean) {
  for (let i = 0; i < 10000 && !predicate(); i++) await Promise.resolve();
  expect(predicate()).toBe(true);
}
export async function execute(document = createSample(), handler?: NodeHandler) {
  const h = harness(document, handler ? { handler } : {});
  h.begin();
  await settle(() => h.engine.ledger.view.result !== null);
  return h;
}
