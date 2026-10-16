import { parseHostMessage } from '../../src/validation/worker';
import { compile } from '../../src/engine/compile';
import { ExecutionEngine } from '../../src/engine/scheduler';
import type { NodeHandler } from '../../src/engine/nodes';
import { executeNode } from '../../src/engine/nodes';
export function installFixture(mode: 'hang' | 'blocked' | 'crash' | 'delay') {
  let engine: ExecutionEngine | null = null;
  const handler: NodeHandler = async (node, input, context) => {
    if (mode === 'delay') {
      // Keep a visible operation window across engines, below MAX_OPERATION_MS (1000).
      await new Promise((resolve) => setTimeout(resolve, 200));
      return executeNode(node, input, context);
    }
    if (mode === 'blocked') {
      while (true) {
        /* Test-only synchronous stall, terminated by host. */
      }
    }
    return new Promise(() => {});
  };
  globalThis.addEventListener('message', (event: MessageEvent<unknown>) => {
    const parsed = parseHostMessage(event.data);
    if (!parsed.ok) throw new Error('Fixture protocol');
    const message = parsed.value;
    if (message.kind === 'start') {
      const result = compile(message.document);
      if (!result.ok) throw new Error('Fixture document');
      engine = new ExecutionEngine(
        {
          protocolVersion: 1,
          sessionId: message.sessionId,
          semanticRevision: message.semanticRevision,
          runId: message.runId,
        },
        result.value,
        {
          now: () => performance.now(),
          yieldControl: () => new Promise((resolve) => setTimeout(resolve, 0)),
          handler,
          publish: (output) => {
            globalThis.postMessage(output);
            if (mode === 'crash' && output.kind === 'node-start')
              setTimeout(() => {
                throw new Error('Synthetic worker crash');
              }, 0);
          },
        },
      );
      engine.acknowledge(message.requestId, 'accepted');
      engine.ready(0);
    } else engine?.control(message);
  });
}
