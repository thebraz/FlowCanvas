import type { ButtonHTMLAttributes, ReactNode } from 'react';
export function Button({
  className = '',
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`button ${className}`}
      {...props}
      onClick={(event) => {
        // WebKit does not focus pointer-activated buttons; dialogs and movement need an invoker.
        event.currentTarget.focus();
        onClick?.(event);
      }}
    />
  );
}
export function Region({
  title,
  id,
  children,
  className = '',
}: {
  readonly title: string;
  readonly id: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <section className={`region ${className}`} aria-labelledby={id}>
      <h2 id={id} tabIndex={-1}>
        {title}
      </h2>
      {children}
    </section>
  );
}
