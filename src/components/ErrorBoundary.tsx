"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Rendered when a child throws. Receives a `reset` to clear the error. */
  fallback: (reset: () => void) => ReactNode;
  /** When this value changes, a caught error is cleared (e.g. on retry/remount). */
  resetKey?: unknown;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render/runtime errors in a subtree so one broken piece (e.g. a single
 * lab) can't white-screen the whole page. The rest of the UI keeps working.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: unknown) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[ErrorBoundary]", error);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback(() => this.setState({ hasError: false }));
    }
    return this.props.children;
  }
}
