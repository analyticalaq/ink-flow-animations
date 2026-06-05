import { useMemo, useState, useEffect } from "react";

export type TimelineItem =
  | {
      type: "text";
      content: string;
      x: number;
      y: number;
      delay?: number;
      duration?: number;
      size?: number;
    }
  | {
      type: "icon";
      name: "brain" | "bulb" | "box" | "stick" | "chart" | "star";
      x: number;
      y: number;
      delay?: number;
      duration?: number;
      size?: number;
    }
  | {
      type: "arrow";
      from: [number, number];
      to: [number, number];
      delay?: number;
      duration?: number;
      curve?: number;
    }
  | {
      type: "circle";
      x: number;
      y: number;
      r: number;
      delay?: number;
      duration?: number;
    }
  | {
      type: "underline";
      from: [number, number];
      to: [number, number];
      delay?: number;
      duration?: number;
    };

export interface WhiteboardCanvasProps {
  timeline: TimelineItem[];
  mode?: "marker" | "chalk" | "sketch";
  loop?: boolean;
  className?: string;
}

const WIDTH = 1920;
const HEIGHT = 1080;

// Generate hand-drawn SVG path for text (approximation: use <text> with stroke
// + clip-path reveal). True per-glyph stroking is impractical without a font
// path library, so we reveal the text by sweeping a clip rect — still looks
// like a hand drawing it across the page.
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// --- Icon path generators (single-path strings, ordered like a hand draws) ---
function iconPath(name: string, size: number): string {
  const s = size;
  switch (name) {
    case "brain":
      // squiggly two-lobed brain
      return `M ${-s * 0.4} 0 q ${-s * 0.15} ${-s * 0.4} ${s * 0.1} ${-s * 0.5} q ${s * 0.2} ${-s * 0.1} ${s * 0.25} ${s * 0.1} q ${s * 0.25} ${-s * 0.2} ${s * 0.45} 0 q ${s * 0.2} ${s * 0.15} ${s * 0.05} ${s * 0.35} q ${s * 0.05} ${s * 0.25} ${-s * 0.15} ${s * 0.3} q ${-s * 0.2} ${s * 0.15} ${-s * 0.4} 0 q ${-s * 0.25} ${-s * 0.05} ${-s * 0.25} ${-s * 0.25} q ${-s * 0.2} ${-s * 0.05} ${-s * 0.1} ${-s * 0.25} z M 0 ${-s * 0.4} q ${-s * 0.05} ${s * 0.3} ${s * 0.02} ${s * 0.5}`;
    case "bulb":
      return `M ${-s * 0.35} ${-s * 0.05} a ${s * 0.4} ${s * 0.4} 0 1 1 ${s * 0.7} 0 q -${s * 0.05} ${s * 0.2} -${s * 0.15} ${s * 0.3} l 0 ${s * 0.2} l -${s * 0.4} 0 l 0 -${s * 0.2} q -${s * 0.1} -${s * 0.1} -${s * 0.15} -${s * 0.3} z M ${-s * 0.2} ${s * 0.5} l ${s * 0.4} 0 M ${-s * 0.15} ${s * 0.62} l ${s * 0.3} 0`;
    case "box":
      return `M ${-s * 0.5} ${-s * 0.5} l ${s} 0 l 0 ${s} l ${-s} 0 z`;
    case "stick":
      // head + body + arms + legs
      return `M 0 ${-s * 0.5} a ${s * 0.15} ${s * 0.15} 0 1 1 0.01 0 z M 0 ${-s * 0.35} l 0 ${s * 0.4} M ${-s * 0.3} ${-s * 0.15} l ${s * 0.6} 0 M 0 ${s * 0.05} l ${-s * 0.25} ${s * 0.45} M 0 ${s * 0.05} l ${s * 0.25} ${s * 0.45}`;
    case "chart":
      return `M ${-s * 0.5} ${s * 0.5} l 0 ${-s} M ${-s * 0.5} ${s * 0.5} l ${s} 0 M ${-s * 0.4} ${s * 0.3} l ${s * 0.25} ${-s * 0.3} l ${s * 0.25} ${s * 0.15} l ${s * 0.4} ${-s * 0.55}`;
    case "star":
      return `M 0 ${-s * 0.5} l ${s * 0.15} ${s * 0.3} l ${s * 0.35} ${s * 0.05} l -${s * 0.25} ${s * 0.22} l ${s * 0.08} ${s * 0.33} l -${s * 0.33} -${s * 0.18} l -${s * 0.33} ${s * 0.18} l ${s * 0.08} -${s * 0.33} l -${s * 0.25} -${s * 0.22} l ${s * 0.35} -${s * 0.05} z`;
    default:
      return `M ${-s * 0.5} 0 l ${s} 0`;
  }
}

function arrowPath(
  from: [number, number],
  to: [number, number],
  curve = 0.2,
): string {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  // perpendicular offset for slight hand-drawn curve
  const cx = mx - dy * curve;
  const cy = my + dx * curve;
  // arrow head
  const angle = Math.atan2(y2 - cy, x2 - cx);
  const headLen = 22;
  const hx1 = x2 - headLen * Math.cos(angle - Math.PI / 7);
  const hy1 = y2 - headLen * Math.sin(angle - Math.PI / 7);
  const hx2 = x2 - headLen * Math.cos(angle + Math.PI / 7);
  const hy2 = y2 - headLen * Math.sin(angle + Math.PI / 7);
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2} M ${x2} ${y2} L ${hx1} ${hy1} M ${x2} ${y2} L ${hx2} ${hy2}`;
}

function circlePath(cx: number, cy: number, r: number): string {
  // start slightly offset so the stroke "starts" visibly
  return `M ${cx + r} ${cy} a ${r} ${r} 0 1 1 -${r * 2} 0 a ${r} ${r} 0 1 1 ${r * 2} 0`;
}

export function WhiteboardCanvas({
  timeline,
  mode = "marker",
  loop = false,
  className,
}: WhiteboardCanvasProps) {
  const isChalk = mode === "chalk";
  const isSketch = mode === "sketch";
  const ink = isChalk ? "#f5f5f0" : isSketch ? "#1d3557" : "#1a1a1a";
  const bg = isChalk ? "#0f2a1f" : isSketch ? "#fdf6e3" : "#fafaf5";
  const animKey = useMemo(() => uid(), []);

  // For loop: re-mount the timeline on interval
  const [cycle, setCycle] = useState(0);
  const totalDuration = useMemo(() => {
    return (
      timeline.reduce((m, it) => {
        const d = (it.delay ?? 0) + (it.duration ?? 1.2);
        return Math.max(m, d);
      }, 0) + 1.5
    );
  }, [timeline]);

  useEffect(() => {
    if (!loop) return;
    const id = setInterval(() => setCycle((c) => c + 1), totalDuration * 1000);
    return () => clearInterval(id);
  }, [loop, totalDuration]);

  return (
    <div
      className={className}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: bg,
        backgroundImage: isChalk
          ? "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.04), transparent 60%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.03), transparent 60%)"
          : "radial-gradient(circle at 30% 20%, rgba(0,0,0,0.025), transparent 60%), radial-gradient(circle at 70% 80%, rgba(0,0,0,0.02), transparent 60%)",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Patrick+Hand&display=swap"
      />
      <style>{`
        @keyframes wb-draw-${animKey} {
          to { stroke-dashoffset: 0; }
        }
        @keyframes wb-blob-${animKey} {
          0% { opacity: 0; transform: scale(0.2); }
          30% { opacity: 0.9; transform: scale(1.4); }
          100% { opacity: 0; transform: scale(1); }
        }
        @keyframes wb-text-reveal-${animKey} {
          to { width: 100%; }
        }
        @keyframes wb-fade-${animKey} {
          to { opacity: 1; }
        }
        .wb-path-${animKey} {
          stroke-dasharray: var(--len);
          stroke-dashoffset: var(--len);
          animation: wb-draw-${animKey} var(--dur, 1.2s) linear var(--delay, 0s) forwards;
        }
        .wb-blob-${animKey} {
          opacity: 0;
          transform-origin: center;
          transform-box: fill-box;
          animation: wb-blob-${animKey} 0.4s ease-out var(--delay, 0s) forwards;
        }
        .wb-text-${animKey} {
          opacity: 0;
          animation: wb-fade-${animKey} 0.2s linear var(--delay, 0s) forwards;
          font-family: ${isChalk ? "'Patrick Hand', cursive" : "'Caveat', cursive"};
          fill: ${ink};
        }
        .wb-text-clip-${animKey} rect {
          animation: wb-text-sweep-${animKey} var(--dur, 1s) linear var(--delay, 0s) forwards;
        }
        @keyframes wb-text-sweep-${animKey} {
          to { width: ${WIDTH}px; }
        }
      `}</style>

      <svg
        key={cycle}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%", maxHeight: "100vh" }}
      >
        <defs>
          <filter id={`wb-rough-${animKey}`}>
            <feTurbulence baseFrequency="0.9" numOctaves="2" seed="3" />
            <feDisplacementMap in="SourceGraphic" scale="1.2" />
          </filter>
        </defs>

        {timeline.map((item, i) => {
          const delay = item.delay ?? 0;
          const duration = item.duration ?? 1.2;
          const key = `${cycle}-${i}`;

          if (item.type === "text") {
            const size = item.size ?? 64;
            const clipId = `wb-clip-${animKey}-${i}-${cycle}`;
            // approximate text width for clip animation
            const approxW = item.content.length * size * 0.55;
            return (
              <g key={key}>
                <defs>
                  <clipPath
                    id={clipId}
                    className={`wb-text-clip-${animKey}`}
                    style={
                      {
                        ["--delay" as string]: `${delay}s`,
                        ["--dur" as string]: `${duration}s`,
                      } as React.CSSProperties
                    }
                  >
                    <rect x={item.x - 10} y={item.y - size} width="0" height={size * 2} />
                  </clipPath>
                </defs>
                <circle
                  cx={item.x}
                  cy={item.y - size * 0.3}
                  r={size * 0.12}
                  fill={ink}
                  className={`wb-blob-${animKey}`}
                  style={{ ["--delay" as string]: `${delay}s` } as React.CSSProperties}
                />
                <text
                  x={item.x}
                  y={item.y}
                  fontSize={size}
                  className={`wb-text-${animKey}`}
                  clipPath={`url(#${clipId})`}
                  style={{ ["--delay" as string]: `${delay}s` } as React.CSSProperties}
                >
                  {item.content}
                </text>
                {/* invisible width hint */}
                <rect
                  x={item.x}
                  y={item.y}
                  width={approxW}
                  height="1"
                  fill="none"
                />
              </g>
            );
          }

          if (item.type === "icon") {
            const size = item.size ?? 120;
            const d = iconPath(item.name, size);
            // rough length estimate — use pathLength for normalized dasharray
            return (
              <g key={key} transform={`translate(${item.x} ${item.y})`}>
                <circle
                  cx={0}
                  cy={0}
                  r={6}
                  fill={ink}
                  className={`wb-blob-${animKey}`}
                  style={{ ["--delay" as string]: `${delay}s` } as React.CSSProperties}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={ink}
                  strokeWidth={isChalk ? 4 : 3.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1000}
                  className={`wb-path-${animKey}`}
                  filter={(isChalk || isSketch) ? `url(#wb-rough-${animKey})` : undefined}
                  style={
                    {
                      ["--len" as string]: "1000",
                      ["--delay" as string]: `${delay}s`,
                      ["--dur" as string]: `${duration}s`,
                    } as React.CSSProperties
                  }
                />
              </g>
            );
          }

          if (item.type === "arrow") {
            const d = arrowPath(item.from, item.to, item.curve ?? 0.15);
            return (
              <g key={key}>
                <circle
                  cx={item.from[0]}
                  cy={item.from[1]}
                  r={5}
                  fill={ink}
                  className={`wb-blob-${animKey}`}
                  style={{ ["--delay" as string]: `${delay}s` } as React.CSSProperties}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={ink}
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1000}
                  className={`wb-path-${animKey}`}
                  filter={(isChalk || isSketch) ? `url(#wb-rough-${animKey})` : undefined}
                  style={
                    {
                      ["--len" as string]: "1000",
                      ["--delay" as string]: `${delay}s`,
                      ["--dur" as string]: `${duration}s`,
                    } as React.CSSProperties
                  }
                />
              </g>
            );
          }

          if (item.type === "circle") {
            const d = circlePath(item.x, item.y, item.r);
            return (
              <g key={key}>
                <circle
                  cx={item.x + item.r}
                  cy={item.y}
                  r={5}
                  fill={ink}
                  className={`wb-blob-${animKey}`}
                  style={{ ["--delay" as string]: `${delay}s` } as React.CSSProperties}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={ink}
                  strokeWidth={4}
                  strokeLinecap="round"
                  pathLength={1000}
                  className={`wb-path-${animKey}`}
                  filter={(isChalk || isSketch) ? `url(#wb-rough-${animKey})` : undefined}
                  style={
                    {
                      ["--len" as string]: "1000",
                      ["--delay" as string]: `${delay}s`,
                      ["--dur" as string]: `${duration}s`,
                    } as React.CSSProperties
                  }
                />
              </g>
            );
          }

          if (item.type === "underline") {
            const [x1, y1] = item.from;
            const [x2, y2] = item.to;
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2 + 6;
            const d = `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
            return (
              <g key={key}>
                <circle
                  cx={x1}
                  cy={y1}
                  r={4}
                  fill={ink}
                  className={`wb-blob-${animKey}`}
                  style={{ ["--delay" as string]: `${delay}s` } as React.CSSProperties}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={ink}
                  strokeWidth={5}
                  strokeLinecap="round"
                  pathLength={1000}
                  className={`wb-path-${animKey}`}
                  style={
                    {
                      ["--len" as string]: "1000",
                      ["--delay" as string]: `${delay}s`,
                      ["--dur" as string]: `${duration}s`,
                    } as React.CSSProperties
                  }
                />
              </g>
            );
          }

          return null;
        })}
      </svg>
    </div>
  );
}

export default WhiteboardCanvas;