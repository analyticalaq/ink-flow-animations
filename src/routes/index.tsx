import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { WhiteboardCanvas, type TimelineItem } from "@/components/WhiteboardCanvas";
import { generateTimeline } from "@/lib/generateTimeline.functions";
import { synthesizeTTS } from "@/lib/tts.functions";
import { Play, Pause, RotateCcw } from "lucide-react";

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
  const tts = useServerFn(synthesizeTTS);
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioCacheKeyRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [audioTimeMs, setAudioTimeMs] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const rafRef = useRef<number | null>(null);
  const autoPlayRef = useRef(false);

  // Drive a rAF loop that mirrors audio.currentTime into React state so
  // the canvas (via currentTimeMs) and the highlighted word stay in lock-step
  // with the ElevenLabs audio — no drift, no separate timers.
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    const tick = () => {
      const a = audioRef.current;
      if (a) setAudioTimeMs(a.currentTime * 1000);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isPlaying]);

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

  // Split narration into words with proportional timings (character-weighted).
  const words = useMemo(() => {
    const text = project.narration ?? "";
    const tokens = text.match(/\S+\s*/g) ?? [];
    const totalChars = tokens.reduce((n, t) => n + t.length, 0) || 1;
    // Use audio duration if we have it, otherwise fall back to the timeline's
    // total duration so highlighting still previews before audio loads.
    const durSec = audioDuration > 0 ? audioDuration : totalDuration;
    let acc = 0;
    return tokens.map((raw) => {
      const start = (acc / totalChars) * durSec;
      acc += raw.length;
      const end = (acc / totalChars) * durSec;
      return { text: raw, start, end };
    });
    // totalDuration is deliberately excluded — highlighting shouldn't jump
    // when the animation scale changes; the audio's real duration wins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.narration, audioDuration]);

  const activeWordIndex = useMemo(() => {
    const t = audioTimeMs / 1000;
    for (let i = words.length - 1; i >= 0; i--) {
      if (t >= words[i].start) return i;
    }
    return -1;
  }, [audioTimeMs, words]);

  useEffect(() => {
    // Invalidate cached audio when narration/voice/speed changes
    audioCacheKeyRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setIsPlaying(false);
  }, [project.narration, voiceId, speed]);

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  // Auto-play voiceover after Generate/Auto-build so the animation and
  // narration start together, no extra click needed.
  useEffect(() => {
    if (!autoPlayRef.current) return;
    if (!project.narration?.trim()) return;
    autoPlayRef.current = false;
    // Defer to next tick so the canvas remount from setPlayKey settles first.
    const t = setTimeout(() => {
      void onPlayVoice();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  async function ensureAudio(): Promise<HTMLAudioElement | null> {
    if (!project.narration?.trim()) return null;
    const key = `${voiceId}|${speed}|${project.narration}`;
    if (audioRef.current && audioCacheKeyRef.current === key) return audioRef.current;
    const res = await tts({ data: { text: project.narration, voiceId, speed } });
    const bin = atob(res.audioBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: res.mime });
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const url = URL.createObjectURL(blob);
    audioUrlRef.current = url;
    const audio = new Audio(url);
    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      setAudioTimeMs(0);
    });
    audio.addEventListener("loadedmetadata", () => {
      if (isFinite(audio.duration)) setAudioDuration(audio.duration);
    });
    audioRef.current = audio;
    audioCacheKeyRef.current = key;
    return audio;
  }

  async function onPlayVoice() {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }
    setVoiceLoading(true);
    try {
      const audio = await ensureAudio();
      if (!audio) {
        toast.error("No narration to play");
        return;
      }
      audio.currentTime = 0;
      // Preload so play() resolves instantly and stays in sync with the canvas restart
      if (audio.readyState < 3) {
        await new Promise<void>((resolve) => {
          const done = () => {
            audio.removeEventListener("canplaythrough", done);
            resolve();
          };
          audio.addEventListener("canplaythrough", done);
          audio.load();
          // Safety timeout so we don't hang if the event never fires
          setTimeout(done, 1500);
        });
      }
      if (isFinite(audio.duration)) setAudioDuration(audio.duration);
      setAudioTimeMs(0);
      // Remount canvas (resets timeline to t=0) and start audio in the same frame
      setPlayKey((k) => k + 1);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await audio.play();
      setIsPlaying(true);
    } catch (e) {
      console.error(e);
      toast.error("Voiceover failed. Please try again.");
    } finally {
      setVoiceLoading(false);
    }
  }

  async function onRestart() {
    setVoiceLoading(true);
    try {
      const audio = await ensureAudio();
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
      setAudioTimeMs(0);
      setPlayKey((k) => k + 1);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await audio.play();
      setIsPlaying(true);
    } catch (e) {
      console.error(e);
      toast.error("Restart failed.");
    } finally {
      setVoiceLoading(false);
    }
  }

  function onSeek(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = Math.max(0, Math.min(audioDuration || audio.duration || 0, seconds));
    audio.currentTime = clamped;
    setAudioTimeMs(clamped * 1000);
  }

  function formatTime(sec: number) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

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


  // Invalidate cached audio whenever narration, voice, or speed changes


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
        autoPlayRef.current = true;
        toast.warning(`${res.error} Built a local animation from your script instead.`);
        return;
      }
      if (!("items" in res) || !res.items?.length) {
        const built = buildTimelineFromScript(script, { durationMinutes, pacing });
        setProject(built);
        setPlayKey((k) => k + 1);
        autoPlayRef.current = true;
        toast.warning("AI returned no items — built a local animation from your script instead.");
        return;
      }
      setProject({
        title: res.title ?? "Untitled",
        narration: res.narration ?? "",
        items: res.items as TimelineItem[],
      });
      setPlayKey((k) => k + 1);
      autoPlayRef.current = true;
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
    autoPlayRef.current = true;
    toast.success(`Auto-built ${built.items.filter((i) => i.type === "icon").length} illustrations from your script`);
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
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onShare}>
              Share link
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

          {project.narration ? (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="mb-1 font-medium text-muted-foreground">Narration</p>
              <p className="text-foreground/90 leading-relaxed">
                {words.map((w, i) => (
                  <span
                    key={i}
                    className={
                      i === activeWordIndex
                        ? "rounded bg-primary/20 text-foreground transition-colors"
                        : i < activeWordIndex
                          ? "text-foreground/50 transition-colors"
                          : "transition-colors"
                    }
                  >
                    {w.text}
                  </span>
                ))}
              </p>
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
              currentTimeMs={audioTimeMs}
              playing={isPlaying}
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

          {/* YouTube-style player controls — drives both audio + canvas */}
          <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 shadow-sm">
            <button
              type="button"
              onClick={onPlayVoice}
              disabled={voiceLoading || !project.narration?.trim()}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={onRestart}
              disabled={voiceLoading || !project.narration?.trim()}
              aria-label="Restart"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border/50 bg-background text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              <RotateCcw size={15} />
            </button>
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatTime(audioTimeMs / 1000)}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(0.1, audioDuration || totalDuration)}
              step={0.05}
              value={Math.min(audioTimeMs / 1000, audioDuration || totalDuration)}
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              disabled={!audioDuration}
              className="h-1 flex-1 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Seek"
            />
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatTime(audioDuration || totalDuration)}
            </span>
            {voiceLoading ? (
              <span className="text-[11px] text-muted-foreground">Loading…</span>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}