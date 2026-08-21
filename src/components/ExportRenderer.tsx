import { useEffect, useRef } from "react";

import { WhiteboardCanvas, type TimelineItem } from "@/components/WhiteboardCanvas";
import { EXPORT_HEIGHT, EXPORT_WIDTH } from "@/lib/exportVideo";

type Props = {
  timeline: TimelineItem[];
  mode: "marker" | "chalk" | "sketch";
  /** Receives the offscreen SVG element once it is mounted. */
  onReady: (svg: SVGSVGElement | null) => void;
};

/**
 * Off-screen, exactly 1920x1080 mount of the whiteboard used only while
 * exporting. It renders with the same component, fonts and styles as the
 * preview, so exported frames are pixel-identical to what the user sees.
 */
export function ExportRenderer({ timeline, mode, onReady }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const svg = hostRef.current?.querySelector("svg") ?? null;
    onReady(svg as SVGSVGElement | null);
    return () => onReady(null);
  }, [onReady, timeline, mode]);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: EXPORT_WIDTH,
        height: EXPORT_HEIGHT,
        opacity: 0,
        pointerEvents: "none",
        zIndex: -1,
        overflow: "hidden",
      }}
    >
      <div ref={hostRef} style={{ width: EXPORT_WIDTH, height: EXPORT_HEIGHT }}>
        <WhiteboardCanvas timeline={timeline} mode={mode} currentTimeMs={0} playing={false} />
      </div>
    </div>
  );
}
