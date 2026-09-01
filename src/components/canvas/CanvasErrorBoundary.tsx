import React from 'react';

interface Props {
  /** Must be R3F elements, not DOM — this boundary lives inside the Canvas. */
  fallback: React.ReactNode;
  children: React.ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Error boundary for content inside the WebGL canvas.
 *
 * Separate from the DOM-level ErrorBoundary because its fallback has to be
 * three.js objects. Its job is narrow: if the character GLB is missing,
 * corrupt, or uses a feature the browser cannot handle, swap in the
 * procedural avatar instead of blanking the whole scene.
 */
export class CanvasErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn(
      '[portfolio] character model failed to load, using the built-in avatar.',
      error.message,
    );
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
