import { createAppStore } from '../../src/state/store';
import { createSample, sampleId } from '../../src/application/sample';
import { validateDocument, validateDocumentShape } from '../../src/validation/codec';
export function makeStore() {
  let id = 100;
  const store = createAppStore(createSample(), sampleId(80), {
    id: () => sampleId(id++),
    now: () => '2026-10-15T13:00:00.000Z',
    validate: validateDocument,
    validateShape: validateDocumentShape,
  });
  store.setState({ bootReady: true });
  return store;
}
