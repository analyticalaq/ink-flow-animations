import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  script: z.string().min(5).max(8000),
  style: z.enum(["explainer", "story", "lecture", "pitch"]).default("explainer"),
  pacing: z.enum(["slow", "normal", "fast"]).default("normal"),
});

const SYSTEM_PROMPT = `You are an animation director that converts a script or topic
into a rich, multi-scene HAND-DRAWN WHITEBOARD animation timeline (think LaminaLabs / RSA Animate style).

Output ONLY valid JSON (no prose, no markdown fences):
{
  "title": string,
  "narration": string,                        // full spoken script, 4-8 short paragraphs
  "items": [ TimelineItem, ... ]
}

TimelineItem variants (ALWAYS include "scene": <integer starting at 0>):
- { "type": "title",    "content": "...", "delay": n, "duration": 1.2, "scene": s }     // big centered headline at top
- { "type": "text",     "content": "...", "x": n, "y": n, "size"?: 44-72, "align"?: "left"|"center"|"right", "delay": n, "duration"?: 0.8, "scene": s }
- { "type": "icon",     "name": IconName, "x": n, "y": n, "size"?: 140-260, "label"?: "short caption", "color"?: "#hex", "delay": n, "duration"?: 1.4, "scene": s }
- { "type": "arrow",    "from": [x,y], "to": [x,y], "delay": n, "duration"?: 0.8, "scene": s }
- { "type": "circle",   "x": n, "y": n, "r": n, "delay": n, "duration"?: 1, "scene": s }   // highlight ring
- { "type": "underline","from": [x,y], "to": [x,y], "delay": n, "duration"?: 0.6, "scene": s }
- { "type": "caption",  "content": "...", "position"?: "bottom-left"|"bottom-right"|"top-right", "delay": n, "scene": s }   // small corner label (e.g. a year, source)

IconName values (use these only):
"brain","bulb","box","stick","chart","star","ship","mountain","castle","mosque","crown",
"king","queen","sword","flag","tower","scroll","book","sun","tree","globe","scale","horse",
"shield","gear","heart","rocket","computer","person","money","clock","target","document",
"megaphone","cloud","phone","robot","leaf","fire","lock","key","chat","checkmark","cross",
"question","house","car","graph","pencil","camera","music"

Rules:
- Canvas is 1920x1080. Keep coordinates within x: 120..1800, y: 240..980. Reserve y < 220 for the title.
- Build 6-10 SCENES. Each scene is a self-contained visual frame lasting 8-14 seconds with a title + 4-7 supporting elements.
- For each new scene, start its first item's delay 0.6s after the previous scene ends. The renderer auto-fades the old scene out.
- Within a scene, sequence delays 1.0-2.0s apart so the viewer can comfortably follow each stroke (smoother pacing).
- Each scene MUST include: one "title" at the top, AT LEAST 3 "icon" items (with helpful "label") forming a simple 2D illustration of the concept, 1-2 "arrow"s connecting related icons, 1-2 short "text" callouts, and optionally a "caption" with a date or source.
- Use icons liberally — every key noun in the narration should be represented by an icon. Compose multiple icons together to illustrate scenes (e.g. person + computer + bulb = "developer has an idea"; rocket + chart + target = "growth strategy"; cloud + phone + lock = "secure mobile sync").
- Vary icon sizes (140-240) and positions to create visually rich, balanced compositions — not just a row of icons.
- Pick icons that visually match the content. Prefer the modern 2D illustration icons (rocket, computer, person, robot, chart, graph, money, target, lightbulb, etc.) for tech/business/everyday topics, and the historical icons (ship, castle, mosque, crown, sword) only for historical topics.
- Keep text SHORT: titles 2-6 words, labels 1-4 words, text callouts under 8 words.
- Total duration target: 60-120 seconds. Use as many items as needed (typically 50-90). Verify the last item's (delay + duration) is between 60 and 120.
- The "narration" field is the spoken script for TTS — write it as a natural flowing voiceover that matches the visual sequence.`;

export type GeneratedItem = {
  type: string;
  content?: string;
  name?: string;
  label?: string;
  x?: number;
  y?: number;
  r?: number;
  size?: number;
  from?: [number, number];
  to?: [number, number];
  curve?: number;
  align?: "left" | "center" | "right";
  position?: "bottom-left" | "bottom-right" | "top-right";
  color?: string;
  delay?: number;
  duration?: number;
  scene?: number;
};

export const generateTimeline = createServerFn({ method: "POST" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { error: "AI Gateway not configured." as const };
    }

    const pacingHint =
      data.pacing === "slow"
        ? "Use generous delays (1.8-2.8s between items) and longer scenes (12-16s each). Target ~110-120s total."
        : data.pacing === "fast"
        ? "Use tight delays (0.8-1.4s between items) and snappier scenes (7-10s each). Target ~60-75s total."
        : "Use moderate delays (~1.2-1.8s between items) and balanced scenes (10-12s each). Target ~80-100s total.";

    const userPrompt = `Style: ${data.style}. ${pacingHint}\n\nSCRIPT / TOPIC:\n${data.script}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return { error: "Rate limit hit. Try again shortly." as const };
      if (res.status === 402) return { error: "AI credits exhausted. Add credits in workspace settings." as const };
      const txt = await res.text();
      console.error("AI gateway error", res.status, txt);
      return { error: `AI gateway error (${res.status}).` as const };
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "{}";

    let parsed: { title?: string; narration?: string; items?: GeneratedItem[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      return { error: "AI returned malformed JSON." as const };
    }

    const items: GeneratedItem[] = Array.isArray(parsed.items) ? parsed.items : [];
    return {
      title: parsed.title ?? "Untitled",
      narration: parsed.narration ?? "",
      items,
    };
  });
