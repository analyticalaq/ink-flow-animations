/**
 * Deterministic 1920x1080 video export for the whiteboard renderer.
 *
 * The preview already seeks every animation with the Web Animations API, so a
 * frame at time T can be reproduced exactly. The exporter drives the same
 * animations frame by frame, serialises the SVG (with the web fonts inlined as
 * base64 so text renders identically), rasterises it to a 1920x1080 canvas and
 * feeds the frames to WebCodecs. The narration is decoded and muxed alongside,
 * so the MP4 keeps the audio/visual sync the preview establishes.
 */

export const EXPORT_WIDTH = 1920;
export const EXPORT_HEIGHT = 1080;
export const EXPORT_FPS = 30;

export type ExportProgress = {
  /** 0..1 */
  ratio: number;
  currentSeconds: number;
  totalSeconds: number;
};

export type ExportResult = {
  blob: Blob;
  extension: "mp4" | "webm";
};

export class ExportCancelled extends Error {
  constructor() {
    super("Export cancelled");
    this.name = "ExportCancelled";
  }
}

export function isExportSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as { VideoEncoder?: unknown }).VideoEncoder === "function"
  );
}

/* ------------------------------------------------------------------ fonts */

let fontCssPromise: Promise<string> | null = null;

/** Google-hosted @font-face rules with every font file inlined as a data URL. */
async function getInlinedFontCss(): Promise<string> {
  if (fontCssPromise) return fontCssPromise;
  fontCssPromise = (async () => {
    const links = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
    ).filter((l) => l.href.includes("fonts.googleapis.com"));
    const sheets = await Promise.all(
      links.map(async (l) => {
        try {
          const res = await fetch(l.href, { mode: "cors" });
          return res.ok ? await res.text() : "";
        } catch {
          return "";
        }
      }),
    );
    let css = sheets.join("\n");
    const urls = Array.from(new Set(css.match(/https:\/\/fonts\.gstatic\.com[^)'"]+/g) ?? []));
    const pairs = await Promise.all(
      urls.map(async (url) => {
        try {
          const res = await fetch(url, { mode: "cors" });
          if (!res.ok) return [url, null] as const;
          const buf = await res.arrayBuffer();
          return [url, `data:font/woff2;base64,${arrayBufferToBase64(buf)}`] as const;
        } catch {
          return [url, null] as const;
        }
      }),
    );
    for (const [url, dataUrl] of pairs) {
      if (dataUrl) css = css.split(url).join(dataUrl);
    }
    return css;
  })();
  return fontCssPromise;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/* ----------------------------------------------------------- frame capture */

/** Style properties that carry the animated state we must freeze per frame. */
const BAKED_PROPS = [
  "opacity",
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-opacity",
  "stroke-width",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "transform",
  "transform-origin",
  "transform-box",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "letter-spacing",
  "text-transform",
  "text-anchor",
  "paint-order",
  "filter",
  "display",
  "visibility",
  "mix-blend-mode",
  // The text-sweep clip animates the rect's CSS `width` geometry property.
  "width",
  "height",
] as const;

/**
 * Keeps a single clone of the live SVG alive for the whole export and only
 * rewrites the animated inline styles each frame. Cloning + re-querying the
 * whole tree per frame was the main cost of the old exporter.
 */
class FrameSerializer {
  private clone: SVGSVGElement;
  private pairs: Array<{ style: CSSStyleDeclaration; target: SVGElement }> = [];
  private serializer = new XMLSerializer();

  constructor(
    private svg: SVGSVGElement,
    fontCss: string,
    outWidth: number,
    outHeight: number,
  ) {
    this.clone = svg.cloneNode(true) as SVGSVGElement;
    const liveNodes = [svg, ...Array.from(svg.querySelectorAll<Element>("*"))];
    const cloneNodes = [
      this.clone,
      ...Array.from(this.clone.querySelectorAll<Element>("*")),
    ];
    for (let i = 0; i < liveNodes.length && i < cloneNodes.length; i++) {
      const target = cloneNodes[i] as SVGElement;
      target.removeAttribute("class");
      // getComputedStyle returns a live view — read it again each frame.
      this.pairs.push({ style: window.getComputedStyle(liveNodes[i]), target });
    }

    this.clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    this.clone.setAttribute("width", String(outWidth));
    this.clone.setAttribute("height", String(outHeight));
    this.clone.removeAttribute("style");

    const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
    styleEl.textContent = fontCss;
    this.clone.insertBefore(styleEl, this.clone.firstChild);
  }

  /** True when the live tree changed shape and the clone must be rebuilt. */
  isStale(): boolean {
    return this.svg.querySelectorAll("*").length + 1 !== this.pairs.length;
  }

  serialize(): string {
    for (const { style, target } of this.pairs) {
      let inline = "animation:none;";
      for (const prop of BAKED_PROPS) {
        const value = style.getPropertyValue(prop);
        if (value) inline += `${prop}:${value};`;
      }
      target.setAttribute("style", inline);
    }
    return this.serializer.serializeToString(this.clone);
  }
}

type Painter = {
  draw: (svgMarkup: string) => Promise<void>;
  frameSource: HTMLCanvasElement | OffscreenCanvas;
};

function createPainter(outWidth: number, outHeight: number, background: string): Painter {
  const canvas: HTMLCanvasElement | OffscreenCanvas =
    typeof OffscreenCanvas === "function"
      ? new OffscreenCanvas(outWidth, outHeight)
      : Object.assign(document.createElement("canvas"), {
          width: outWidth,
          height: outHeight,
        });
  const ctx = (
    canvas as HTMLCanvasElement
  ).getContext("2d", { alpha: false }) as CanvasRenderingContext2D | null;
  if (!ctx) throw new Error("Could not create the export canvas.");

  return {
    frameSource: canvas,
    async draw(svgMarkup: string) {
      const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
      let bitmap: ImageBitmap | null = null;
      try {
        bitmap = await createImageBitmap(blob, {
          resizeWidth: outWidth,
          resizeHeight: outHeight,
          resizeQuality: "high",
        });
      } catch {
        bitmap = null;
      }
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, outWidth, outHeight);
      if (bitmap) {
        ctx.drawImage(bitmap, 0, 0, outWidth, outHeight);
        bitmap.close();
        return;
      }
      // Safari/Firefox can't decode SVG through createImageBitmap.
      const url = URL.createObjectURL(blob);
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        ctx.drawImage(img, 0, 0, outWidth, outHeight);
      } finally {
        URL.revokeObjectURL(url);
      }
    },
  };
}

/* ---------------------------------------------------------------- encoding */

type CodecChoice = {
  extension: "mp4" | "webm";
  videoCodec: string;
  audioCodec: string;
  /** False when no audio codec is available for the chosen container. */
  canEncodeAudio: boolean;
};

/** H.264 profile/level candidates, widest support first, then higher levels. */
const H264_CANDIDATES = [
  "avc1.640028", // High 4.0
  "avc1.64002A", // High 4.2
  "avc1.640032", // High 5.0
  "avc1.640033", // High 5.1
  "avc1.4D4028", // Main 4.0
  "avc1.42E028", // Baseline 4.0
];

function bitrateFor(outWidth: number, outHeight: number, durationSeconds: number): number {
  // ~0.1 bits per pixel per frame, clamped, and trimmed for long renders so a
  // 10-minute export doesn't build a gigabyte-sized buffer in memory.
  const perFrame = outWidth * outHeight * 0.1;
  let bitrate = Math.round(Math.min(10_000_000, Math.max(3_000_000, perFrame * EXPORT_FPS)));
  if (durationSeconds > 240) bitrate = Math.round(bitrate * 0.6);
  else if (durationSeconds > 120) bitrate = Math.round(bitrate * 0.8);
  return bitrate;
}

async function supportsVideo(codec: string, w: number, h: number, bitrate: number) {
  try {
    const r = await VideoEncoder.isConfigSupported({
      codec,
      width: w,
      height: h,
      bitrate,
      framerate: EXPORT_FPS,
    });
    return !!r.supported;
  } catch {
    return false;
  }
}

async function supportsAudio(codec: string, sampleRate: number, channels: number) {
  try {
    const r = await AudioEncoder.isConfigSupported({
      codec,
      sampleRate,
      numberOfChannels: channels,
      bitrate: 128_000,
    });
    return !!r.supported;
  } catch {
    return false;
  }
}

async function pickCodec(
  outWidth: number,
  outHeight: number,
  bitrate: number,
  audio: { sampleRate: number; channels: number } | null,
): Promise<CodecChoice> {
  for (const codec of H264_CANDIDATES) {
    if (await supportsVideo(codec, outWidth, outHeight, bitrate)) {
      const canEncodeAudio = audio
        ? await supportsAudio("mp4a.40.2", audio.sampleRate, audio.channels)
        : false;
      return { extension: "mp4", videoCodec: codec, audioCodec: "mp4a.40.2", canEncodeAudio };
    }
  }
  const vp9 = "vp09.00.50.08";
  if (await supportsVideo(vp9, outWidth, outHeight, bitrate)) {
    const canEncodeAudio = audio
      ? await supportsAudio("opus", audio.sampleRate, audio.channels)
      : false;
    return { extension: "webm", videoCodec: vp9, audioCodec: "opus", canEncodeAudio };
  }
  throw new Error(
    `This browser can't encode ${outWidth}x${outHeight} video. Try Chrome, or switch format.`,
  );
}

async function decodeNarration(
  audioBlob: Blob | null,
): Promise<AudioBuffer | null> {
  if (!audioBlob) return null;
  try {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    const ctx = new AudioCtx();
    const buf = await ctx.decodeAudioData(await audioBlob.arrayBuffer());
    void ctx.close();
    return buf;
  } catch {
    return null;
  }
}


export type ExportOptions = {
  /** Live SVG element of the offscreen 1920x1080 renderer. */
  svg: SVGSVGElement;
  /** Total video length in seconds. */
  durationSeconds: number;
  /** Narration audio (as fetched from ElevenLabs) to bake into the file. */
  audioBlob?: Blob | null;
  /** Board background colour, painted under every frame. */
  background?: string;
  /** Output resolution (defaults to 1920x1080). */
  width?: number;
  height?: number;
  onProgress?: (p: ExportProgress) => void;
  signal?: AbortSignal;
};

export async function exportWhiteboardVideo({
  svg,
  durationSeconds,
  audioBlob = null,
  background = "#ffffff",
  width: outWidth = EXPORT_WIDTH,
  height: outHeight = EXPORT_HEIGHT,
  onProgress,
  signal,
}: ExportOptions): Promise<ExportResult> {
  if (!isExportSupported()) throw new Error("This browser cannot encode video (WebCodecs missing).");

  const throwIfCancelled = () => {
    if (signal?.aborted) throw new ExportCancelled();
  };

  const [fontCss, choice, audioBuffer] = await Promise.all([
    getInlinedFontCss(),
    pickCodec(outWidth, outHeight),
    decodeNarration(audioBlob),
  ]);
  throwIfCancelled();

  const totalSeconds = Math.max(1, durationSeconds);
  const totalFrames = Math.ceil(totalSeconds * EXPORT_FPS);

  const { Muxer: Mp4Muxer, ArrayBufferTarget: Mp4Target } = await import("mp4-muxer");
  const { Muxer: WebmMuxer, ArrayBufferTarget: WebmTarget } = await import("webm-muxer");

  const useMp4 = choice.extension === "mp4";
  const target = useMp4 ? new Mp4Target() : new WebmTarget();
  const muxer = useMp4
    ? new Mp4Muxer({
        target: target as InstanceType<typeof Mp4Target>,
        fastStart: "in-memory",
        video: { codec: "avc", width: outWidth, height: outHeight, frameRate: EXPORT_FPS },
        ...(audioBuffer
          ? {
              audio: {
                codec: "aac" as const,
                numberOfChannels: Math.min(2, audioBuffer.numberOfChannels),
                sampleRate: audioBuffer.sampleRate,
              },
            }
          : {}),
      })
    : new WebmMuxer({
        target: target as InstanceType<typeof WebmTarget>,
        video: { codec: "V_VP9", width: outWidth, height: outHeight, frameRate: EXPORT_FPS },
        ...(audioBuffer
          ? {
              audio: {
                codec: "A_OPUS" as const,
                numberOfChannels: Math.min(2, audioBuffer.numberOfChannels),
                sampleRate: audioBuffer.sampleRate,
              },
            }
          : {}),
      });

  const anyMuxer = muxer as unknown as {
    addVideoChunk: (c: EncodedVideoChunk, m?: unknown) => void;
    addAudioChunk: (c: EncodedAudioChunk, m?: unknown) => void;
    finalize: () => void;
  };

  let encodeError: unknown = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => anyMuxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encodeError = e;
    },
  });
  videoEncoder.configure({
    codec: choice.videoCodec,
    width: outWidth,
    height: outHeight,
    bitrate: 8_000_000,
    framerate: EXPORT_FPS,
    ...(useMp4 ? { avc: { format: "avc" as const } } : {}),
  });

  const canvas = document.createElement("canvas");
  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Could not create the export canvas.");

  const animations = svg.getAnimations({ subtree: true });

  try {
    for (let frame = 0; frame < totalFrames; frame++) {
      throwIfCancelled();
      if (encodeError) throw encodeError;

      const timeMs = (frame / EXPORT_FPS) * 1000;
      for (const a of animations) {
        try {
          a.pause();
          a.currentTime = timeMs;
        } catch {
          /* animation finished/cancelled */
        }
      }
      // Let the browser apply the seeked styles before we read them back.
      await new Promise<void>((r) => requestAnimationFrame(() => r()));

      await drawFrame(
        serializeFrame(svg, fontCss, outWidth, outHeight),
        ctx,
        background,
        outWidth,
        outHeight,
      );

      const videoFrame = new VideoFrame(canvas, {
        timestamp: Math.round((frame / EXPORT_FPS) * 1_000_000),
        duration: Math.round(1_000_000 / EXPORT_FPS),
      });
      videoEncoder.encode(videoFrame, { keyFrame: frame % (EXPORT_FPS * 2) === 0 });
      videoFrame.close();

      if (videoEncoder.encodeQueueSize > 8) {
        await videoEncoder.flush();
      }
      onProgress?.({
        ratio: (frame + 1) / totalFrames,
        currentSeconds: (frame + 1) / EXPORT_FPS,
        totalSeconds,
      });
    }

    await videoEncoder.flush();

    if (audioBuffer) {
      throwIfCancelled();
      await encodeAudio(audioBuffer, choice.audioCodec, totalSeconds, anyMuxer, throwIfCancelled);
    }

    anyMuxer.finalize();
    const buffer = (target as { buffer: ArrayBuffer }).buffer;
    return {
      blob: new Blob([buffer], { type: useMp4 ? "video/mp4" : "video/webm" }),
      extension: choice.extension,
    };
  } finally {
    try {
      videoEncoder.close();
    } catch {
      /* already closed */
    }
    for (const a of animations) {
      try {
        a.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  }
}

async function encodeAudio(
  buffer: AudioBuffer,
  codec: string,
  totalSeconds: number,
  muxer: { addAudioChunk: (c: EncodedAudioChunk, m?: unknown) => void },
  throwIfCancelled: () => void,
): Promise<void> {
  const channels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const totalSamples = Math.min(buffer.length, Math.ceil(totalSeconds * sampleRate));

  let audioError: unknown = null;
  const encoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => {
      audioError = e;
    },
  });
  encoder.configure({
    codec,
    sampleRate,
    numberOfChannels: channels,
    bitrate: 128_000,
  });

  const chunkFrames = 4096;
  for (let offset = 0; offset < totalSamples; offset += chunkFrames) {
    throwIfCancelled();
    if (audioError) throw audioError;
    const count = Math.min(chunkFrames, totalSamples - offset);
    const planar = new Float32Array(count * channels);
    for (let c = 0; c < channels; c++) {
      const data = buffer.getChannelData(c);
      planar.set(data.subarray(offset, offset + count), c * count);
    }
    const audioData = new AudioData({
      format: "f32-planar",
      sampleRate,
      numberOfFrames: count,
      numberOfChannels: channels,
      timestamp: Math.round((offset / sampleRate) * 1_000_000),
      data: planar,
    });
    encoder.encode(audioData);
    audioData.close();
    if (encoder.encodeQueueSize > 16) await encoder.flush();
  }
  await encoder.flush();
  encoder.close();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
