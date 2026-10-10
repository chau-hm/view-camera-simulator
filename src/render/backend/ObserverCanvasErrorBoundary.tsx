import { Component, type ErrorInfo, type ReactNode } from "react";

type ObserverCanvasErrorBoundaryProps = Readonly<{
  children: ReactNode;
  onError: (error: Error, info: ErrorInfo) => void;
}>;

type ObserverCanvasErrorBoundaryState = Readonly<{ hasError: boolean }>;

/** Isolates the Observer Canvas setup error so its host can attempt one fallback. */
export class ObserverCanvasErrorBoundary extends Component<
  ObserverCanvasErrorBoundaryProps,
  ObserverCanvasErrorBoundaryState
> {
  state: ObserverCanvasErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ObserverCanvasErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError(error, info);
  }

  render(): ReactNode {
    return this.state.hasError ? null : this.props.children;
  }
}
