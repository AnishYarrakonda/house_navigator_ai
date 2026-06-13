// A left-docked, draggable side panel. The map is the home screen on both
// sides, and the person's current location flies to the CENTER of the map — so
// the input panel must never sit over the middle. This docks to the left edge
// and can be dragged anywhere (or collapsed) by its header, keeping the center
// clear. Pointer-events (mouse + touch) so it works on phones too.
//
// Generic + presentational: the crisis and volunteer panels both wrap their
// content in one of these so the two modes feel like mirror images.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Icon from "./Icon";

interface DraggablePanelProps {
  title: ReactNode;
  /** Decorative leading glyph in the header. */
  icon?: ReactNode;
  /** Distinct key so each mode remembers its own dragged position. */
  storageKey: string;
  children: ReactNode;
}

interface Pos {
  x: number;
  y: number;
}

const WIDTH = 360;
const MARGIN = 12;
const TOP_OFFSET = 64; // clears the mode toggle in the top-left

function defaultPos(): Pos {
  return { x: MARGIN, y: TOP_OFFSET };
}

function clamp(pos: Pos): Pos {
  if (typeof window === "undefined") return pos;
  const maxX = Math.max(MARGIN, window.innerWidth - WIDTH - MARGIN);
  const maxY = Math.max(MARGIN, window.innerHeight - 120);
  return {
    x: Math.min(Math.max(MARGIN, pos.x), maxX),
    y: Math.min(Math.max(MARGIN, pos.y), maxY),
  };
}

export default function DraggablePanel({
  title,
  icon,
  storageKey,
  children,
}: DraggablePanelProps) {
  const fullKey = `waypoint.panelpos.${storageKey}`;
  const [pos, setPos] = useState<Pos>(() => {
    if (typeof window === "undefined") return defaultPos();
    const raw = window.localStorage.getItem(fullKey);
    if (raw) {
      try {
        return clamp(JSON.parse(raw) as Pos);
      } catch {
        /* ignore */
      }
    }
    return defaultPos();
  });
  const [collapsed, setCollapsed] = useState(false);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  // Persist position so a dragged panel stays put across mode switches.
  useEffect(() => {
    window.localStorage.setItem(fullKey, JSON.stringify(pos));
  }, [fullKey, pos]);

  // Keep the panel on-screen if the window is resized.
  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragRef.current) return;
    setPos(
      clamp({ x: e.clientX - dragRef.current.dx, y: e.clientY - dragRef.current.dy }),
    );
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    document.body.style.userSelect = "";
  }, [onPointerMove]);

  const onHandleDown = useCallback(
    (e: React.PointerEvent) => {
      // Don't start a drag from the collapse button.
      if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
      dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [pos.x, pos.y, onPointerMove, onPointerUp],
  );

  return (
    <div
      className="pointer-events-auto fixed z-20 w-[360px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[18px] border border-wp-line2 bg-[rgba(12,13,16,0.92)] shadow-wp-lg backdrop-blur-[22px]"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Drag handle / header */}
      <div
        onPointerDown={onHandleDown}
        className="flex cursor-grab touch-none items-center gap-2 border-b border-wp-line px-3.5 py-2.5 active:cursor-grabbing"
      >
        <Icon name="drag_indicator" size={18} className="shrink-0 text-wp-txf" />
        {icon ? (
          <span aria-hidden className="flex shrink-0 items-center text-wp-acc2">
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate font-serif text-[15px] text-wp-tx">
          {title}
        </span>
        <button
          type="button"
          data-no-drag
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand panel" : "Collapse panel"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-wp-txd hover:bg-wp-surf3 hover:text-wp-tx"
        >
          <Icon name={collapsed ? "expand_more" : "expand_less"} size={20} />
        </button>
      </div>

      {/* Body */}
      {!collapsed ? (
        <div className="max-h-[calc(100dvh-140px)] overflow-y-auto p-3.5">
          {children}
        </div>
      ) : null}
    </div>
  );
}
