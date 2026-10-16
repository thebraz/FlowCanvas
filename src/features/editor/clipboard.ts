import type { AppStore } from '../../state/store';
import { errorMessage } from '../../ui/messages';
import { editorPoint } from './placement';
export function copyClipboard(store: AppStore) {
  const s = store.getState(),
    copied = s.copySelection();
  if (!copied.ok) {
    s.announce(errorMessage(copied.error));
    return;
  }
  if (!navigator.clipboard) {
    s.showModal('copy');
    return;
  }
  const session = s.session.sessionId;
  void navigator.clipboard
    .writeText(copied.value)
    .then(() => {
      if (store.getState().session.sessionId === session)
        store.getState().announce('Selection copied.');
    })
    .catch(() => {
      if (store.getState().session.sessionId === session) store.getState().showModal('copy');
    });
}
export function pasteClipboard(store: AppStore) {
  const s = store.getState(),
    session = s.session.sessionId,
    center = editorPoint(store);
  if (!navigator.clipboard) {
    s.showModal('paste');
    return;
  }
  void navigator.clipboard
    .readText()
    .then((text) => {
      if (store.getState().session.sessionId !== session) return;
      store.getState().request(() => {
        if (store.getState().session.sessionId !== session) return;
        const result = store.getState().paste(text, center);
        if (!result.ok) store.getState().announce(errorMessage(result.error));
      });
    })
    .catch(() => {
      if (store.getState().session.sessionId === session) store.getState().showModal('paste');
    });
}
