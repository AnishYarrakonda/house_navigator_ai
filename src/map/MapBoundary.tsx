// Error boundary around the MapLibre map. If the map fails to initialize (no
// WebGL on an old device, or the basemap can't load on weak signal), we must
// NOT blank the whole app — the crisis/volunteer panels still need to work
// (accessibility.md: "degrade gracefully on weak signal"). On failure we render
// a calm dark backdrop in place of the map and let the overlay UI carry on.

import { Component, type ReactNode } from "react";
import { WARM_BG } from "./style";

interface Props {
  children: ReactNode;
}
interface State {
  failed: boolean;
}

export default class MapBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Surface for debugging; the UI itself stays usable.
    console.error("Map failed to load — falling back to a plain backdrop.", error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div
          className="absolute inset-0"
          style={{ background: WARM_BG }}
          aria-hidden="true"
        />
      );
    }
    return this.props.children;
  }
}
