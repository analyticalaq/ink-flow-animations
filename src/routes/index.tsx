import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { WhiteboardCanvas, type TimelineItem } from "@/components/WhiteboardCanvas";
import { generateTimeline } from "@/lib/generateTimeline.functions";
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
type VoiceStyle = "natural" | "energetic" | "calm" | "serious";

const VOICE_STYLES: Record<VoiceStyle, { pitch: number; rateBias: number; label: string }> = {
  natural: { pitch: 1.0, rateBias: 1.0, label: "Natural" },
  energetic: { pitch: 1.15, rateBias: 1.08, label: "Energetic" },
  calm: { pitch: 0.95, rateBias: 0.92, label: "Calm" },
  serious: { pitch: 0.85, rateBias: 0.95, label: "Serious" },
};

function StudioPage() {
  const generate = useServerFn(generateTimeline);
  const [script, setScript] = useState(STARTER_SCRIPT);
  const [style, setStyle] = useState<"explainer" | "story" | "lecture" | "pitch">("explainer");
  const [pacing, setPacing] = useState<Pacing>("normal");
  const [mode, setMode] = useState<Mode>("marker");
  const [project, setProject] = useState<Project>(DEMO);
  const [loading, setLoading] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string>("");
  const [voiceStyle, setVoiceStyle] = useState<VoiceStyle>("natural");
  // Narration speed multiplier (also scales animation timeline so export stays in sync)
  const [speed, setSpeed] = useState<number>(1);

  const canvasWrapRef = useRef<HTMLDivElement>(null);

  // Load available browser voices
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => {
      const list = window.speechSynthesis.getVoices();
      setVoices(list);
      if (list.length && !voiceURI) {
        const preferred =
          list.find((v) => v.lang.startsWith("en") && v.default) ??
          list.find((v) => v.lang.startsWith("en")) ??
          list[0];
        setVoiceURI(preferred.voiceURI);
      }
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [voiceURI]);

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
      const res = await generate({ data: { script, style, pacing } });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      if (!("items" in res) || !res.items?.length) {
        toast.error("AI returned no items. Try a longer prompt.");
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

  function speakNarration() {
    if (!("speechSynthesis" in window) || !project.narration) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(project.narration);
    const preset = VOICE_STYLES[voiceStyle];
    u.rate = Math.max(0.5, Math.min(2, speed * preset.rateBias));
    u.pitch = preset.pitch;
    const v = voices.find((x) => x.voiceURI === voiceURI);
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  }

  function onPlay() {
    setPlayKey((k) => k + 1);
    // start narration shortly after first stroke
    window.setTimeout(speakNarration, 250);
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

  async function onExport() {
    const wrap = canvasWrapRef.current;
    if (!wrap) return;
    if (typeof (window as unknown as { MediaRecorder?: unknown }).MediaRecorder === "undefined") {
      toast.error("Your browser doesn't support video export.");
      return;
    }
    setExporting(true);
    setPlayKey((k) => k + 1);

    try {
      const svgEl = wrap.querySelector("svg");
      if (!svgEl) throw new Error("No canvas");
      const svg: SVGSVGElement = svgEl as SVGSVGElement;

      const W = 1280;
      const H = 720;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      const stream = canvas.captureStream(30);
      const mimeCandidates = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      const mime = mimeCandidates.find((m) =>
        (window as unknown as { MediaRecorder: { isTypeSupported: (s: string) => boolean } })
          .MediaRecorder.isTypeSupported(m),
      )!;
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

      const done = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
      });

      // Start narration in sync with recording
      speakNarration();
      recorder.start();

      const start = performance.now();
      const durationMs = totalDuration * 1000 + 500;
      let stopped = false;

      async function frame() {
        if (stopped) return;
        const now = performance.now();
        const elapsed = now - start;
        // Serialize current SVG (with running animations) to image
        const svgClone = svg.cloneNode(true) as SVGSVGElement;
        svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        const xml = new XMLSerializer().serializeToString(svgClone);
        const img = new Image();
        const blobUrl = URL.createObjectURL(
          new Blob([xml], { type: "image/svg+xml" }),
        );
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = () => rej(new Error("svg image"));
          img.src = blobUrl;
        });
        ctx.fillStyle = mode === "chalk" ? "#0f2a1f" : mode === "sketch" ? "#fdf6e3" : "#fafaf5";
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(img, 0, 0, W, H);
        URL.revokeObjectURL(blobUrl);

        if (elapsed < durationMs) {
          requestAnimationFrame(() => frame());
        } else {
          stopped = true;
          recorder.stop();
        }
      }
      requestAnimationFrame(() => frame());

      const blob = await done;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(project.title || "whiteboard").replace(/\s+/g, "-").toLowerCase()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Video exported");
    } catch (e) {
      console.error(e);
      toast.error("Export failed.");
    } finally {
      setExporting(false);
    }
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
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onShare}>
              Share link
            </Button>
            <Button size="sm" onClick={onExport} disabled={exporting}>
              {exporting ? "Exporting…" : "Export .webm"}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[360px_1fr]">
        <section className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="script">Script or topic</Label>
            <Textarea
              id="script"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={8}
              placeholder="Paste a script or describe a topic…"
              className="resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Style</Label>
              <Select value={style} onValueChange={(v) => setStyle(v as typeof style)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="explainer">Explainer</SelectItem>
                  <SelectItem value="story">Story</SelectItem>
                  <SelectItem value="lecture">Lecture</SelectItem>
                  <SelectItem value="pitch">Pitch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pacing</Label>
              <Select value={pacing} onValueChange={(v) => setPacing(v as Pacing)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="slow">Slow</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="fast">Fast</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Visual style</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["marker", "chalk", "sketch"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-md border px-3 py-2 text-sm capitalize transition-colors ${
                    mode === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-md border bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Voice
            </p>
            <div className="space-y-2">
              <Label className="text-xs">Voice</Label>
              <Select
                value={voiceURI}
                onValueChange={(v) => setVoiceURI(v)}
                disabled={!voices.length}
              >
                <SelectTrigger>
                  <SelectValue placeholder={voices.length ? "Pick a voice" : "Loading…"} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {voices.map((v) => (
                    <SelectItem key={v.voiceURI} value={v.voiceURI}>
                      {v.name} — {v.lang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Voice style</Label>
              <Select value={voiceStyle} onValueChange={(v) => setVoiceStyle(v as VoiceStyle)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(VOICE_STYLES) as VoiceStyle[]).map((k) => (
                    <SelectItem key={k} value={k}>{VOICE_STYLES[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Narration speed</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {speed.toFixed(2)}×
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.05}
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
              <p className="text-[11px] text-muted-foreground">
                Scales both voice and animation so the exported video stays in sync.
              </p>
            </div>
          </div>

          <Button
            onClick={onGenerate}
            disabled={loading || !script.trim()}
            className="w-full"
          >
            {loading ? "Generating…" : "Generate animation"}
          </Button>

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onPlay}>
              Replay
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => window.speechSynthesis?.cancel()}
            >
              Stop voice
            </Button>
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
            className="aspect-[16/9] w-full overflow-hidden rounded-lg border shadow-sm"
          >
            <WhiteboardCanvas
              key={`${mode}-${playKey}`}
              timeline={scaledItems}
              mode={mode}
            />
          </div>
        </section>
      </main>
    </div>
  );
}