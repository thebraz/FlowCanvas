import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './primitives';
export function Modal({
  title,
  children,
  onClose,
  initialCancel = false,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly onClose: () => void;
  readonly initialCancel?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current,
      previous = document.activeElement;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    const first = dialog.querySelector<HTMLElement>(
      initialCancel ? '[data-cancel]' : 'input,textarea,select,button',
    );
    first?.focus();
    return () => {
      dialog.close?.();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
      else document.getElementById('editor')?.focus();
    };
  }, [initialCancel]);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className="modal"
      onKeyDown={(event) => {
        if (
          event.key !== 'Tab' ||
          !(event.target instanceof Element) ||
          event.target.closest('dialog') !== event.currentTarget
        )
          return;
        const controls = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'button,input,textarea,select,a[href],[tabindex="0"]',
            ),
          ).filter((el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0),
          first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2>{title}</h2>
      {children}
      <Button data-cancel onClick={onClose}>
        Cancel
      </Button>
    </dialog>
  );
}
