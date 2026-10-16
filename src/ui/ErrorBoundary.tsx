import { Component, type ReactNode } from 'react';
import { Button } from './primitives';
export class ErrorBoundary extends Component<
  { readonly children: ReactNode },
  { readonly failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError(): { readonly failed: boolean } {
    return { failed: true };
  }
  override render() {
    if (this.state.failed)
      return (
        <section className="render-error" role="alert">
          <h2>Something went wrong</h2>
          <p>Your existing workflow has been preserved. Try restoring the view.</p>
          <Button
            onClick={() => {
              this.setState({ failed: false });
            }}
          >
            Restore view
          </Button>
        </section>
      );
    return this.props.children;
  }
}
