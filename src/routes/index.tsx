import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { WhiteboardCanvas, type TimelineItem } from "@/components/WhiteboardCanvas";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Whiteboard Canvas" },
      { name: "description", content: "Hand-drawn whiteboard animation demo." },
      { property: "og:title", content: "Whiteboard Canvas" },
      { property: "og:description", content: "Hand-drawn whiteboard animation demo." },
    ],
  }),
  component: Index,
});

const timeline: TimelineItem[] = [
  { type: "text", content: "What is AI?", x: 200, y: 200, delay: 0, duration: 1.2, size: 96 },
  { type: "underline", from: [200, 230], to: [820, 235], delay: 1.3, duration: 0.6 },
  { type: "icon", name: "brain", x: 600, y: 480, delay: 2.0, duration: 1.4, size: 220 },
  { type: "arrow", from: [400, 220], to: [540, 430], delay: 3.5, duration: 0.9 },
  { type: "text", content: "learns from data", x: 850, y: 460, delay: 4.5, duration: 1.0, size: 56 },
  { type: "icon", name: "chart", x: 1500, y: 460, delay: 5.6, duration: 1.2, size: 200 },
  { type: "arrow", from: [1180, 460], to: [1400, 460], delay: 6.9, duration: 0.7 },
  { type: "icon", name: "stick", x: 300, y: 850, delay: 7.7, duration: 1.4, size: 240 },
  { type: "icon", name: "bulb", x: 1600, y: 850, delay: 9.2, duration: 1.3, size: 220 },
  { type: "circle", x: 1600, y: 850, r: 180, delay: 10.6, duration: 1.0 },
];

function Index() {
  const [mode, setMode] = useState<"marker" | "chalk">("marker");
  const [nonce, setNonce] = useState(0);
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b">
        <h1 className="text-lg font-semibold">Whiteboard Canvas</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setMode((m) => (m === "marker" ? "chalk" : "marker"))}
            className="px-3 py-1.5 rounded-md border text-sm hover:bg-accent"
          >
            {mode === "marker" ? "Switch to Chalkboard" : "Switch to Whiteboard"}
          </button>
          <button
            onClick={() => setNonce((n) => n + 1)}
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm"
          >
            Replay
          </button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-[1600px] aspect-[16/9] shadow-lg rounded-lg overflow-hidden">
          <WhiteboardCanvas key={`${mode}-${nonce}`} timeline={timeline} mode={mode} />
        </div>
      </div>
    </div>
  );
}
