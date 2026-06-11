import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { WhiteboardCanvas, type TimelineItem } from "@/components/WhiteboardCanvas";
import { generateTimeline } from "@/lib/generateTimeline.functions";
import { synthesizeTTS } from "@/lib/tts.functions";
import { buildTimelineFromScript } from "@/lib/scriptToTimeline";
import { toCanvas } from "html-to-image";
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmTarget } from "webm-muxer";
import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from "mp4-muxer";
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
  const tts = useServerFn(synthesizeTTS);
  const [script, setScript] = useState(STARTER_SCRIPT);
  const [style, setStyle] = useState<"explainer" | "story" | "lecture" | "pitch">("explainer");
  const [pacing, setPacing] = useState<Pacing>("normal");
  const [durationMinutes, setDurationMinutes] = useState<number>(2);
  const [mode, setMode] = useState<Mode>("marker");
  const [project, setProject] = useState<Project>(DEMO);
  const [loading, setLoading] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [voiceId, setVoiceId] = useState<string>(ELEVEN_VOICES[0].id);
  const [ttsLoading, setTtsLoading] = useState(false);
  // Narration speed multiplier (also scales animation timeline so export stays in sync)
  const [speed, setSpeed] = useState<number>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  // Cache key: invalidates audio when narration / voice / speed changes
  const audioCacheKeyRef = useRef<string>("");

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

  // Stop & clear any cached audio element
  function stopAudio() {
    const a = audioRef.current;
    if (a) {
      try {
        a.pause();
        a.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  }
  function disposeAudio() {
    stopAudio();
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    audioRef.current = null;
    audioCacheKeyRef.current = "";
  }

  // Invalidate cached audio whenever narration, voice, or speed changes
  useEffect(() => {
    disposeAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.narration, voiceId, speed]);

  useEffect(() => () => disposeAudio(), []);

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
        setIsPlaying(true);
        toast.warning(`${res.error} Built a local animation from your script instead.`);
        return;
      }
      if (!("items" in res) || !res.items?.length) {
        const built = buildTimelineFromScript(script, { durationMinutes, pacing });
        setProject(built);
        setPlayKey((k) => k + 1);
        setIsPlaying(true);
        toast.warning("AI returned no items — built a local animation from your script instead.");
        return;
      }
      setProject({
        title: res.title ?? "Untitled",
        narration: res.narration ?? "",
        items: res.items as TimelineItem[],
      });
      setPlayKey((k) => k + 1);
      setIsPlaying(true);
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
    setIsPlaying(true);
    toast.success(`Auto-built ${built.items.filter((i) => i.type === "icon").length} illustrations from your script`);
  }

  async function ensureAudio(): Promise<HTMLAudioElement | null> {
    if (!project.narration) return null;
    const key = `${voiceId}|${speed}|${project.narration}`;
    if (audioRef.current && audioCacheKeyRef.current === key) return audioRef.current;
    disposeAudio();
    setTtsLoading(true);
    try {
      const res = await tts({
        data: { text: project.narration, voiceId, speed },
      });
      const url = `data:${res.mime};base64,${res.audioBase64}`;
      const a = new Audio(url);
      audioRef.current = a;
      audioUrlRef.current = url;
      audioCacheKeyRef.current = key;
      a.addEventListener("ended", () => setIsPlaying(false));
      return a;
    } catch (e) {
      console.error(e);
      toast.error("Voice generation failed. Check your ElevenLabs connection.");
      return null;
    } finally {
      setTtsLoading(false);
    }
  }

  async function onPlay() {
    if (isPlaying) {
      setIsPlaying(false);
      audioRef.current?.pause();
      return;
    }
    setIsPlaying(true);
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

  async function onExport() {
    const wrap: HTMLDivElement | null = canvasWrapRef.current;
    if (!wrap) return;
    const wrapEl: HTMLElement = wrap;
    const hasWebCodecs =
      typeof (window as unknown as { VideoEncoder?: unknown }).VideoEncoder !== "undefined";
    if (!hasWebCodecs) {
      toast.error(
        "Reliable export needs Chrome, Edge, or Opera (WebCodecs). Please try one of those.",
      );
      return;
    }

    setExporting(true);
    setExportProgress(0);
    // Re-mount the canvas so all CSS animations start at time 0
    setPlayKey((k) => k + 1);
    // Stop any narration; export is silent video (audio recording isn't
    // reliable across browsers and was the source of desync)
    stopAudio();

    const W = 1280;
    const H = 720;
    const fps = 30;
    const durationSec = totalDuration + 0.4;
    const totalFrames = Math.max(1, Math.ceil(durationSec * fps));
    const bgColor =
      mode === "chalk" ? "#0f2a1f" : mode === "sketch" ? "#fdf6e3" : "#fafaf5";

    // Give the canvas a tick to mount before we pause animations
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => setTimeout(r, 50));

    type AnyAnim = Animation & { currentTime: number | null };
    const anims = (wrapEl.getAnimations({ subtree: true }) as AnyAnim[]).filter(
      (a) => a.effect,
    );
    anims.forEach((a) => {
      try {
        a.pause();
      } catch {
        /* ignore */
      }
    });

    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = W;
    tmpCanvas.height = H;
    const ctx = tmpCanvas.getContext("2d")!;

    try {
      // Prefer MP4 (H.264) because it plays everywhere; fall back to WebM/VP9.
      const supportsH264 = await VideoEncoder.isConfigSupported({
        codec: "avc1.42E01F",
        width: W,
        height: H,
        bitrate: 4_000_000,
        framerate: fps,
      }).then((r) => !!r.supported).catch(() => false);

      let muxerKind: "mp4" | "webm" = supportsH264 ? "mp4" : "webm";
      let mp4Muxer: Mp4Muxer<Mp4Target> | null = null;
      let webmMuxer: WebmMuxer<WebmTarget> | null = null;

      if (muxerKind === "mp4") {
        mp4Muxer = new Mp4Muxer({
          target: new Mp4Target(),
          fastStart: "in-memory",
          video: { codec: "avc", width: W, height: H },
        });
      } else {
        webmMuxer = new WebmMuxer({
          target: new WebmTarget(),
          video: { codec: "V_VP9", width: W, height: H, frameRate: fps },
        });
      }

      const encoder = new VideoEncoder({
        output: (chunk, meta) => {
          if (muxerKind === "mp4") mp4Muxer!.addVideoChunk(chunk, meta);
          else webmMuxer!.addVideoChunk(chunk, meta);
        },
        error: (e) => console.error("encoder error", e),
      });

      encoder.configure(
        muxerKind === "mp4"
          ? {
              codec: "avc1.42E01F",
              width: W,
              height: H,
              bitrate: 4_000_000,
              framerate: fps,
              avc: { format: "avc" },
            }
          : {
              codec: "vp09.00.10.08",
              width: W,
              height: H,
              bitrate: 4_000_000,
              framerate: fps,
            },
      );

      const frameUs = 1_000_000 / fps;

      for (let f = 0; f < totalFrames; f++) {
        const tSec = f / fps;
        // Scrub every CSS animation to the exact timeline moment
        anims.forEach((a) => {
          try {
            const ms = tSec * 1000;
            // currentTime is local to each animation's timeline; clamp to
            // its active duration so finished animations stay finished.
            const timing = a.effect?.getComputedTiming();
            const endTime =
              typeof timing?.endTime === "number"
                ? (timing.endTime as number)
                : Number(timing?.endTime ?? Infinity);
            a.currentTime = Math.min(ms, isFinite(endTime) ? endTime : ms);
          } catch {
            /* ignore */
          }
        });

        // Let the browser commit the scrubbed styles before snapshotting
        await new Promise((r) => requestAnimationFrame(() => r(null)));

        // Bake the live, scrubbed animation state into inline styles on every
        // animated element. html-to-image serializes the DOM into an SVG
        // <foreignObject>, which RESTARTS CSS @keyframes at time 0 in the
        // snapshot — so without baking we'd capture the initial (invisible)
        // state of every element on every frame. Baking computed values and
        // disabling the animation makes the snapshot match what's on screen.
        const animated = Array.from(
          wrapEl.querySelectorAll<HTMLElement | SVGElement>(
            '[class*="wb-path-"],[class*="wb-fill-"],[class*="wb-blob-"],[class*="wb-text-"],[class*="wb-scene-out-"],[class*="wb-text-clip-"] rect',
          ),
        );
        const saved: Array<{ el: HTMLElement | SVGElement; cssText: string }> = [];
        animated.forEach((el) => {
          const cs = window.getComputedStyle(el);
          saved.push({ el, cssText: el.getAttribute("style") || "" });
          const s = (el as HTMLElement).style;
          s.animation = "none";
          s.opacity = cs.opacity;
          if (cs.transform && cs.transform !== "none") s.transform = cs.transform;
          const sdo = cs.getPropertyValue("stroke-dashoffset");
          if (sdo) s.setProperty("stroke-dashoffset", sdo);
          const sda = cs.getPropertyValue("stroke-dasharray");
          if (sda) s.setProperty("stroke-dasharray", sda);
          if (el.tagName.toLowerCase() === "rect") {
            const w = cs.width;
            if (w) s.setProperty("width", w);
          }
        });

        let snap: HTMLCanvasElement | null = null;
        try {
          snap = await toCanvas(wrapEl, {
            width: W,
            height: H,
            canvasWidth: W,
            canvasHeight: H,
            backgroundColor: bgColor,
            pixelRatio: 1,
            cacheBust: false,
            skipFonts: true,
          });
        } catch (err) {
          console.warn("snapshot failed", err);
        }

        // Restore inline styles so the live animation continues correctly
        saved.forEach(({ el, cssText }) => {
          if (cssText) el.setAttribute("style", cssText);
          else el.removeAttribute("style");
        });

        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, W, H);
        if (snap) ctx.drawImage(snap, 0, 0, W, H);

        const vf = new VideoFrame(tmpCanvas, {
          timestamp: Math.round(f * frameUs),
          duration: Math.round(frameUs),
        });
        encoder.encode(vf, { keyFrame: f % fps === 0 });
        vf.close();

        // Throttle so we don't pile up frames in the encoder
        if (encoder.encodeQueueSize > 8) {
          await new Promise((r) => setTimeout(r, 8));
        }

        setExportProgress((f + 1) / totalFrames);
      }

      await encoder.flush();
      encoder.close();

      let blob: Blob;
      let ext: string;
      if (muxerKind === "mp4") {
        mp4Muxer!.finalize();
        blob = new Blob([(mp4Muxer!.target as Mp4Target).buffer], {
          type: "video/mp4",
        });
        ext = "mp4";
      } else {
        webmMuxer!.finalize();
        blob = new Blob([(webmMuxer!.target as WebmTarget).buffer], {
          type: "video/webm",
        });
        ext = "webm";
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(project.title || "whiteboard")
        .replace(/\s+/g, "-")
        .toLowerCase()}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Video exported as .${ext}`);
    } catch (e) {
      console.error(e);
      toast.error("Export failed.");
    } finally {
      // Resume animations & restart the live preview
      anims.forEach((a) => {
        try {
          a.play();
        } catch {
          /* ignore */
        }
      });
      setExporting(false);
      setExportProgress(0);
      setPlayKey((k) => k + 1);
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
              {exporting
                ? `Exporting ${Math.round(exportProgress * 100)}%`
                : "Download video"}
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Video length</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {durationMinutes} min
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>1m</span><span>5m</span><span>10m</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              The AI scales scenes, items, and narration to fit the target length.
            </p>
          </div>

          <div className="space-y-3 rounded-md border bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Voice
            </p>
          <div className="space-y-2">
              <Label className="text-xs">Voice (ElevenLabs)</Label>
              <Select value={voiceId} onValueChange={(v) => setVoiceId(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {ELEVEN_VOICES.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Powered by ElevenLabs. Audio is generated on demand and cached for this narration.
              </p>
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

          <Button
            onClick={onAutoBuild}
            disabled={!script.trim()}
            variant="outline"
            className="w-full"
          >
            Auto-build from script (no AI)
          </Button>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1 gap-2 transition-transform hover:scale-105 active:scale-95"
              onClick={onPlay}
              disabled={ttsLoading || !project.narration}
            >
              {ttsLoading ? (
                <>Generating voice…</>
              ) : isPlaying ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                  Pause
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Play
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                stopAudio();
                setIsPlaying(false);
              }}
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
            className={`relative w-full overflow-hidden rounded-lg border shadow-sm ${
              isFullscreen ? "h-screen bg-background" : "aspect-[16/9]"
            }`}
          >
            <WhiteboardCanvas
              key={`${mode}-${playKey}`}
              timeline={scaledItems}
              mode={mode}
              playing={isPlaying}
            />
            <div className="absolute right-3 top-3 z-10 flex gap-2">
              <button
                type="button"
                onClick={onExport}
                disabled={exporting}
                aria-label="Download video"
                title="Download video"
                className="rounded-md border border-border/40 bg-background/70 p-2 text-foreground shadow-sm backdrop-blur transition-all hover:scale-105 hover:bg-background active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
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