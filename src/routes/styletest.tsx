import { createFileRoute } from "@tanstack/react-router";
import { WhiteboardCanvas, type TimelineItem } from "@/components/WhiteboardCanvas";

const items: TimelineItem[] = [
  { type: "title", content: "How Simi Works", delay: 0, duration: 1.2, scene: 0 },
  { type: "icon", name: "chat", x: 300, y: 520, size: 200, label: "your prompt", delay: 1, duration: 1.4, scene: 0 },
  { type: "arrow", from: [430, 520], to: [630, 520], delay: 2, duration: 0.8, scene: 0 },
  { type: "icon", name: "brain", x: 760, y: 520, size: 200, label: "simi", delay: 2.6, duration: 1.4, scene: 0 },
  { type: "icon", name: "scroll", x: 1200, y: 380, size: 170, label: "script", delay: 3.6, duration: 1.4, scene: 0 },
  { type: "icon", name: "pencil", x: 1200, y: 620, size: 170, label: "illustrations", delay: 4.4, duration: 1.4, scene: 0 },
  { type: "icon", name: "rocket", x: 1620, y: 500, size: 190, label: "finished video", delay: 5.2, duration: 1.4, scene: 0 },
  { type: "text", content: "in seconds", x: 960, y: 950, size: 64, align: "center", delay: 6.2, duration: 1, scene: 0 },
];

export const Route = createFileRoute("/styletest")({
  head: () => ({ meta: [{ title: "Style test" }] }),
  component: () => (
    <div style={{ width: "100vw", height: "100vh" }}>
      <WhiteboardCanvas timeline={items} mode="marker" />
    </div>
  ),
});
