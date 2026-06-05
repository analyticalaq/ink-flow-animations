import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  script: z.string().min(5).max(8000),
  style: z.enum(["explainer", "story", "lecture", "pitch"]).default("explainer"),
  pacing: z.enum(["slow", "normal", "fast"]).default("normal"),
});

const SYSTEM_PROMPT = `You are an animation director that converts a short script or topic
into a hand-drawn whiteboard animation TIMELINE.

Output ONLY valid JSON matching this schema (no prose, no markdown fences):
{
  "title": string,
  "narration": string,        // a clean spoken script (1-3 short paragraphs)
  "items": [
    { "type": "text",   "content": string, "x": number, "y": number, "size"?: number, "delay": number, "duration"?: number },
    { "type": "icon",   "name": "brain"|"bulb"|"box"|"stick"|"chart"|"star", "x": number, "y": number, "size"?: number, "delay": number, "duration"?: number },
    { "type": "arrow",  "from": [number,number], "to": [number,number], "delay": number, "duration"?: number },
    { "type": "circle", "x": number, "y": number, "r": number, "delay": number, "duration"?: number },
    { "type": "underline", "from": [number,number], "to": [number,number], "delay": number, "duration"?: number }
  ]
}

Rules:
- Canvas is 1920x1080. Keep all coordinates within 80..1840 x 80..1000.
- 8-16 items total. Sequence delays in seconds, monotonically increasing, starting at 0.
- Mix text headings, supporting icons, arrows connecting related ideas, underlines for emphasis, and an occasional highlight circle.
- Heading text size 80-110, body text size 44-64.
- Keep text SHORT (1-6 words per text item). Break long sentences into multiple text items.
- Use arrows to show flow between concepts; coordinates should match the source/target element positions.
- Total duration should be 15-35 seconds.`;

type Item = Record<string, unknown> & { delay?: number };

export const generateTimeline = createServerFn({ method: "POST" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { error: "AI Gateway not configured." as const };
    }

    const pacingHint =
      data.pacing === "slow"
        ? "Use generous delays (1.5-2.5s between items)."
        : data.pacing === "fast"
        ? "Use tight delays (0.5-1s between items)."
        : "Use moderate delays (~1-1.5s between items).";

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

    let parsed: { title?: string; narration?: string; items?: Item[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      return { error: "AI returned malformed JSON." as const };
    }

    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return {
      title: parsed.title ?? "Untitled",
      narration: parsed.narration ?? "",
      items,
    };
  });