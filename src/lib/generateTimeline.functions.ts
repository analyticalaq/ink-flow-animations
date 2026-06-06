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
"shield","gear","heart"

Rules:
- Canvas is 1920x1080. Keep coordinates within x: 120..1800, y: 240..980. Reserve y < 220 for the title.
- Build 4-7 SCENES. Each scene is a self-contained visual frame (title + 3-6 supporting elements).
- For each new scene, start its first item's delay 0.4s after the previous scene ends. The renderer auto-fades the old scene out.
- Within a scene, sequence delays 0.6-1.5s apart so the viewer can follow each stroke.
- Each scene should include: one "title" at the top, 2-4 "icon" items (with helpful "label"), optional "arrow"s connecting them, optional "caption" for a date or source.
- Pick icons that visually match the content (a ship for voyage, mosque for religion, crown for monarchy, chart for data, brain for thinking, etc.).
- Keep text SHORT: titles 2-6 words, labels 1-4 words.
- Total duration target: 45-90 seconds. Use as many items as needed (typically 30-60).
- The "narration" field is the spoken script for TTS — write it as a natural flowing voiceover that matches the visual sequence.`;

export type GeneratedItem = Record<string, unknown>;

export const generateTimeline = createServerFn({ method: "POST" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { error: "AI Gateway not configured." as const };
    }

    const pacingHint =
      data.pacing === "slow"
        ? "Use generous delays (1.4-2.2s between items) and longer scenes."
        : data.pacing === "fast"
        ? "Use tight delays (0.5-1s between items) and snappier scenes."
        : "Use moderate delays (~0.9-1.5s between items).";

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
