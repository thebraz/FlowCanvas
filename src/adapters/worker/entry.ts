import { failure } from '../../contracts/errors';
import type { RunIdentity } from '../../contracts/session';
import { compile } from '../../engine/compile';
import { ExecutionEngine } from '../../engine/scheduler';
import { parseHostMessage } from '../../validation/worker';

let engine: ExecutionEngine | null = null;
let incomingSequence = 0;
const channel = new MessageChannel();
const yields: (() => void)[] = [];
channel.port1.onmessage = () => yields.shift()?.();
const yieldControl = () =>
  new Promise<void>((resolve) => {
    yields.push(resolve);
    channel.port2.postMessage(null);
  });
globalThis.addEventListener('message', (event: MessageEvent<unknown>) => {
  const parsed = parseHostMessage(event.data);
  if (!parsed.ok) {
    engine?.finish('failed', parsed.error);
    return;
  }
  const message = parsed.value;
  if (
    engine &&
    (message.sessionId !== engine.identity.sessionId ||
      message.semanticRevision !== engine.identity.semanticRevision ||
      message.runId !== engine.identity.runId)
  )
    return;
  if (message.sequence !== incomingSequence + 1) {
    engine?.finish('failed', failure('WORKER_PROTOCOL', 'execution').error);
    return;
  }
  incomingSequence++;
  if (message.kind === 'start') {
    if (engine || message.sequence !== 1) {
      engine?.finish('failed', failure('WORKER_PROTOCOL', 'execution').error);
      return;
    }
    const startedAt = performance.now();
    const identity: RunIdentity = {
      protocolVersion: 1,
      sessionId: message.sessionId,
      semanticRevision: message.semanticRevision,
      runId: message.runId,
    };
    const compiled = compile(message.document);
    engine = new ExecutionEngine(
      identity,
      compiled.ok ? compiled.value : null,
      {
        now: () => performance.now(),
        yieldControl,
        publish: (output) => globalThis.postMessage(output),
      },
      startedAt,
    );
    engine.acknowledge(message.requestId, 'accepted');
    if (compiled.ok) engine.ready(performance.now() - startedAt);
    else engine.finish('failed', compiled.error);
  } else engine?.control(message);
});
