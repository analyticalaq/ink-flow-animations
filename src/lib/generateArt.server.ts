import { z } from "zod";

export const artInputSchema = z.object({
  briefs: z.array(z.string().min(2).max(300)).min(1).max(24),
});

export type ArtShape = {
  d: string;
  fill?: string;
  stroke?: string;
  width?: number;
};

const SYSTEM = `You are an illustrator that draws simple flat-cartoon whiteboard illustrations as raw SVG.

Return ONLY valid JSON: {"svg": "<svg viewBox=\\"0 0 200 200\\">...</svg>"}

Hard rules:
- viewBox is exactly "0 0 200 200". Fill the frame (roughly x/y 10..190).
- Allowed elements ONLY: path, circle, ellipse, rect, line, polyline, polygon, g.
- Allowed attributes ONLY: d, cx, cy, r, rx, ry, x, y, width, height, x1, y1, x2, y2, points, fill, stroke, stroke-width.
- NO text, images, gradients, filters, shadows, styles, classes, scripts, opacity, transforms, or external references.
- Style: bold black outlines (stroke "#111111", stroke-width 4) with flat solid colour fills.
- Fills must be simple hex colours from this palette: #f2b134 #e85d3a #4a90c4 #3d8a4a #d94a5c #8d4ea0 #7b4a2a #a8c5dc #f2c94c #ffffff #111111
- 4-14 shapes total. Clear, chunky, readable at a glance — no fine detail, no hatching.
- Draw the literal subject requested. No captions, no decorative backgrounds.`;
// (no background rectangle: the board is already white)

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function num(v: string | undefined, fallback = 0): number {
  const n = Number.parseFloat(v ?? "");
  return Number.isFinite(n) ? n : fallback;
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z-]+)\s*=\s*"([^"]*)"|([a-zA-Z-]+)\s*=\s*'([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) {
    const key = (m[1] ?? m[3])!.toLowerCase();
    out[key] = (m[2] ?? m[4] ?? "").trim();
  }
  return out;
}

function color(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (v === "none" || v === "transparent") return undefined;
  if (v === "black") return "#111111";
  if (v === "white") return "#ffffff";
  return HEX.test(v) ? v : undefined;
}

function safePathData(d: string): string | undefined {
  const cleaned = d.replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length > 4000) return undefined;
  return /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\-+\s]+$/.test(cleaned) ? cleaned : undefined;
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0 Z`;
}

function pointsPath(points: string, close: boolean): string | undefined {
  const nums = points
    .trim()
    .split(/[\s,]+/)
    .map((p) => Number.parseFloat(p))
    .filter((n) => Number.isFinite(n));
  if (nums.length < 4) return undefined;
  let d = `M ${nums[0]} ${nums[1]}`;
  for (let i = 2; i + 1 < nums.length; i += 2) d += ` L ${nums[i]} ${nums[i + 1]}`;
  return close ? `${d} Z` : d;
}

/** Parses AI-produced SVG markup into a sanitised list of drawable path shapes. */
export function svgToShapes(svg: string): ArtShape[] {
  const shapes: ArtShape[] = [];
  const tagRe = /<\s*(path|circle|ellipse|rect|line|polyline|polygon)\b([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(svg)) && shapes.length < 40) {
    const name = m[1];
    const a = attrs(m[2] ?? "");
    let d: string | undefined;
    if (name === "path") d = safePathData(a.d ?? "");
    else if (name === "circle") {
      const r = num(a.r);
      if (r > 0) d = ellipsePath(num(a.cx), num(a.cy), r, r);
    } else if (name === "ellipse") {
      const rx = num(a.rx), ry = num(a.ry);
      if (rx > 0 && ry > 0) d = ellipsePath(num(a.cx), num(a.cy), rx, ry);
    } else if (name === "rect") {
      const w = num(a.width), h = num(a.height);
      if (w > 0 && h > 0) {
        const x = num(a.x), y = num(a.y);
        d = `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
      }
    } else if (name === "line") {
      d = `M ${num(a.x1)} ${num(a.y1)} L ${num(a.x2)} ${num(a.y2)}`;
    } else {
      d = pointsPath(a.points ?? "", name === "polygon");
    }
    if (!d) continue;
    const fill = color(a.fill);
    const stroke = color(a.stroke) ?? "#111111";
    const width = Math.min(10, Math.max(1, num(a["stroke-width"], 4)));
    if (isFullFrameBackground(d, fill)) continue;
    shapes.push({ d, ...(fill ? { fill } : {}), stroke, width });
  }
  return shapes;
}

/** Drops full-canvas background plates the model sometimes adds. */
function isFullFrameBackground(d: string, fill: string | undefined): boolean {
  if (!fill || (fill !== "#ffffff" && fill !== "#fff")) return false;
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  if (nums.length < 4 || nums.length > 12) return false;
  const xs = nums.filter((_, i) => i % 2 === 0);
  const ys = nums.filter((_, i) => i % 2 === 1);
  const span = (arr: number[]) => Math.max(...arr) - Math.min(...arr);
  return span(xs) >= 190 && span(ys) >= 190;
}

async function drawOne(brief: string, apiKey: string): Promise<ArtShape[] | null> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Draw: ${brief}` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      console.error("art gateway error", res.status, await res.text());
      return null;
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as { svg?: string };
    if (!parsed.svg) return null;
    const shapes = svgToShapes(parsed.svg);
    return shapes.length >= 2 ? shapes : null;
  } catch (e) {
    console.error("art generation failed", e);
    return null;
  }
}

export async function generateArtResult(data: z.infer<typeof artInputSchema>) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { error: "AI Gateway not configured." as const, art: {} };

  const unique = Array.from(new Set(data.briefs.map((b) => b.trim()).filter(Boolean)));
  const art: Record<string, ArtShape[]> = {};

  const CONCURRENCY = 4;
  let cursor = 0;
  async function worker() {
    while (cursor < unique.length) {
      const brief = unique[cursor++]!;
      const shapes = await drawOne(brief, apiKey!);
      if (shapes) art[brief] = shapes;
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, unique.length) }, worker));

  return { art };
}
