import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { WhiteboardCanvas, type TimelineItem } from "@/components/WhiteboardCanvas";
import { generateTimeline } from "@/lib/generateTimeline.functions";

import { buildTimelineFromScript } from "@/lib/scriptToTimeline";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Whiteboard Studio — AI Animated Explainers" },
      {
        name: "description",
        content:
          "Turn any script or topic into a hand-drawn whiteboard animation with voiceover. Customize style, pacing, and export to video.",
      },
      { property: "og:title", content: "Whiteboard Studio" },
      {
        property: "og:description",
        content: "Turn any script into a hand-drawn whiteboard animation.",
      },
    ],
  }),
  component: StudioPage,
});

type Project = {
  title: string;
  narration: string;
  items: TimelineItem[];
};

const STARTER_SCRIPT =
  "Explain what artificial intelligence is in simple terms — how it learns from data, why it matters, and one everyday example.";

const DEMO: Project = {
  title: "What is AI?",
  narration:
    "Artificial intelligence is software that learns patterns from data. It studies millions of examples, finds the patterns humans miss, and uses what it learned to make smart decisions — from recognizing faces in photos to recommending the next song you'll love.",
  items: [
    // Scene 0 — title card
    { type: "title", content: "What is AI?", delay: 0, duration: 1.4, scene: 0 },
    { type: "icon", name: "brain", x: 960, y: 580, size: 280, label: "thinking machine", delay: 1.6, duration: 1.6, scene: 0 },
    { type: "caption", content: "an introduction", position: "bottom-left", delay: 3.4, scene: 0 },
    // Scene 1 — it learns from data
    { type: "title", content: "It learns from data", delay: 5.5, duration: 1.4, scene: 1 },
    { type: "icon", name: "chart", x: 400, y: 600, size: 220, label: "data", delay: 7.0, duration: 1.4, scene: 1 },
    { type: "arrow", from: [560, 600], to: [820, 600], delay: 8.6, duration: 0.8, scene: 1 },
    { type: "icon", name: "brain", x: 980, y: 600, size: 220, label: "learns", delay: 9.6, duration: 1.4, scene: 1 },
    { type: "arrow", from: [1140, 600], to: [1400, 600], delay: 11.2, duration: 0.8, scene: 1 },
    { type: "icon", name: "bulb", x: 1560, y: 600, size: 220, label: "insight", delay: 12.2, duration: 1.4, scene: 1 },
    // Scene 2 — everyday examples
    { type: "title", content: "Everywhere already", delay: 15.5, duration: 1.4, scene: 2 },
    { type: "icon", name: "globe", x: 380, y: 620, size: 230, label: "translate", delay: 17.0, duration: 1.5, scene: 2 },
    { type: "icon", name: "heart", x: 960, y: 620, size: 220, label: "recommend", delay: 18.8, duration: 1.5, scene: 2 },
    { type: "icon", name: "shield", x: 1540, y: 620, size: 230, label: "protect", delay: 20.6, duration: 1.5, scene: 2 },
    { type: "caption", content: "2025", position: "bottom-right", delay: 22.4, scene: 2 },
    // Scene 3 — the big idea
    { type: "title", content: "Patterns, not rules", delay: 24.5, duration: 1.4, scene: 3 },
    { type: "icon", name: "scroll", x: 520, y: 620, size: 240, label: "old way", delay: 26.0, duration: 1.4, scene: 3 },
    { type: "arrow", from: [700, 620], to: [1100, 620], delay: 27.6, duration: 0.9, scene: 3 },
    { type: "icon", name: "gear", x: 1300, y: 620, size: 240, label: "new way", delay: 28.7, duration: 1.6, scene: 3 },
    { type: "circle", x: 1300, y: 620, r: 200, color: "#d94a5c", delay: 30.5, duration: 1.0, scene: 3 },
  ],
};

type Mode = "marker" | "chalk" | "sketch";
type Pacing = "slow" | "normal" | "fast";

// Curated ElevenLabs voice presets (see ElevenLabs Voice Library for more)
const ELEVEN_VOICES: Array<{ id: string; label: string }> = [
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah — warm narrator" },
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George — calm British" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam — friendly explainer" },
  { id: "cgSgspJ2msm6clMCkdW9", label: "Jessica — bright & clear" },
  { id: "nPczCjzI2devNBz1zQrb", label: "Brian — deep & grounded" },
  { id: "FGY2WhTYpPnrIDTdsKH5", label: "Laura — energetic" },
  { id: "iP95p4xoKVk53GoZ742B", label: "Chris — conversational" },
  { id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily — soft & gentle" },
];

function StudioPage() {
  const generate = useServerFn(generateTimeline);
  const [script, setScript] = useState(STARTER_SCRIPT);
  const [style, setStyle] = useState<"explainer" | "story" | "lecture" | "pitch">("explainer");
  const [pacing, setPacing] = useState<Pacing>("normal");
  const [durationMinutes, setDurationMinutes] = useState<number>(2);
  const [mode, setMode] = useState<Mode>("marker");
  const [project, setProject] = useState<Project>(DEMO);
  const [loading, setLoading] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const [voiceId, setVoiceId] = useState<string>(ELEVEN_VOICES[0].id);
  // Narration speed multiplier (also scales animation timeline so export stays in sync)
  const [speed, setSpeed] = useState<number>(1);

  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    const el = canvasWrapRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.warn("Fullscreen failed", e);
    }
  }




  // Scale timeline by speed so the canvas animation matches narration pacing
  const scaledItems = useMemo<TimelineItem[]>(() => {
    const f = 1 / speed;
    return project.items.map((it) => ({
      ...it,
      delay: (it.delay ?? 0) * f,
      duration: (it.duration ?? 1.2) * f,
    }));
  }, [project.items, speed]);

  const totalDuration = useMemo(() => {
    return (
      scaledItems.reduce((m, it) => {
        const d = (it.delay ?? 0) + (it.duration ?? 1.2);
        return Math.max(m, d);
      }, 0) + 1.5
    );
  }, [scaledItems]);

  async function onGenerate() {
    if (!script.trim()) return;
    setLoading(true);
    try {
      const res = await generate({ data: { script, style, pacing, durationMinutes } });
      if ("error" in res && res.error) {
        // Fall back to deterministic local parser so the user always gets a result.
        const built = buildTimelineFromScript(script, { durationMinutes, pacing });
        setProject(built);
        setPlayKey((k) => k + 1);
        toast.warning(`${res.error} Built a local animation from your script instead.`);
        return;
      }
      if (!("items" in res) || !res.items?.length) {
        const built = buildTimelineFromScript(script, { durationMinutes, pacing });
        setProject(built);
        setPlayKey((k) => k + 1);
        toast.warning("AI returned no items — built a local animation from your script instead.");
        return;
      }
      setProject({
        title: res.title ?? "Untitled",
        narration: res.narration ?? "",
        items: res.items as TimelineItem[],
      });
      setPlayKey((k) => k + 1);
      toast.success("Animation generated");
    } catch (e) {
      console.error(e);
      toast.error("Generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function onAutoBuild() {
    if (!script.trim()) return;
    const built = buildTimelineFromScript(script, { durationMinutes, pacing });
    setProject(built);
    setPlayKey((k) => k + 1);
    toast.success(`Auto-built ${built.items.filter((i) => i.type === "icon").length} illustrations from your script`);
  }


  async function onPlay() {
    if (isPlaying) {
      setIsPlaying(false);
      audioRef.current?.pause();
      return;
    }
    const a = await ensureAudio();
    if (!a) {
      setIsPlaying(false);
      return;
    }
    try {
      await a.play();
    } catch (e) {
      console.warn("audio play blocked", e);
      setIsPlaying(false);
    }
  }

  function onShare() {
    const payload = btoa(
      encodeURIComponent(
        JSON.stringify({ p: project, m: mode }),
      ),
    );
    const url = `${window.location.origin}${window.location.pathname}#v=${payload}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Share link copied"),
      () => toast.error("Couldn't copy link"),
    );
  }

  // Load shared project from hash
  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = window.location.hash;
    const m = h.match(/^#v=(.+)$/);
    if (!m) return;
    try {
      const decoded = JSON.parse(decodeURIComponent(atob(m[1])));
      if (decoded?.p?.items) {
        setProject(decoded.p);
        if (decoded.m) setMode(decoded.m);
      }
    } catch (e) {
      console.warn("Could not parse share link", e);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster />
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Whiteboard Studio</h1>
            <p className="text-xs text-muted-foreground">
              AI-generated hand-drawn explainers
            </p>
          </div>

          {project.narration ? (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="mb-1 font-medium text-muted-foreground">Narration</p>
              <p className="text-foreground/90">{project.narration}</p>
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">{project.title}</h2>
            <span className="text-xs text-muted-foreground">
              ~{Math.ceil(totalDuration)}s
            </span>
          </div>
          <div
            ref={canvasWrapRef}
            className={`relative w-full overflow-hidden rounded-lg border shadow-sm ${
              isFullscreen ? "h-screen bg-background" : "aspect-[16/9]"
            }`}
          >
            <WhiteboardCanvas
              key={`${mode}-${playKey}`}
              timeline={scaledItems}
              mode={mode}
            />
            <div className="absolute right-3 top-3 z-10 flex gap-2">
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? "Exit fullscreen" : "Maximize"}
                title={isFullscreen ? "Exit fullscreen (Esc)" : "Maximize"}
                className="rounded-md border border-border/40 bg-background/70 p-2 text-foreground shadow-sm backdrop-blur transition-all hover:scale-105 hover:bg-background active:scale-95"
              >
                {isFullscreen ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21v-6H3M15 3v6h6M3 9h6V3M21 15h-6v6" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}