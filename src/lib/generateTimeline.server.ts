import { z } from "zod";

export const timelineInputSchema = z.object({
  script: z.string().min(5).max(8000),
  style: z.enum(["explainer", "story", "lecture", "pitch"]).default("explainer"),
  pacing: z.enum(["slow", "normal", "fast"]).default("normal"),
  durationMinutes: z.number().min(1).max(10).default(2),
});

export type GeneratedItem = {
  type: string;
  content?: string;
  name?: string;
  art?: string;
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

const systemPrompt = `You are an animation director that converts a script or topic into a clean, multi-scene HAND-DRAWN WHITEBOARD explainer timeline in the Lamina Labs / Simi style.

Output ONLY valid JSON (no prose, no markdown fences):
{"title": string, "narration": string, "items": [TimelineItem, ...]}

TimelineItem variants (ALWAYS include "scene": <integer starting at 0>):
- { "type": "title", "content": "...", "delay": n, "duration": 1.2, "scene": s }
- { "type": "text", "content": "...", "x": n, "y": n, "size"?: 44-72, "align"?: "left"|"center"|"right", "delay": n, "duration"?: 0.8, "scene": s }
- { "type": "icon", "art": "one-sentence description of the exact drawing", "name": IconName, "x": n, "y": n, "size"?: 180-300, "label"?: "short caption", "color"?: "#hex", "delay": n, "duration"?: 1.4, "scene": s }
- { "type": "arrow", "from": [x,y], "to": [x,y], "delay": n, "duration"?: 0.8, "scene": s }
- { "type": "circle", "x": n, "y": n, "r": n, "delay": n, "duration"?: 1, "scene": s }
- { "type": "underline", "from": [x,y], "to": [x,y], "delay": n, "duration"?: 0.6, "scene": s }
- { "type": "caption", "content": "...", "position"?: "bottom-left"|"bottom-right"|"top-right", "delay": n, "scene": s }

"art" is REQUIRED on every icon item: a concrete, literal description of the picture to draw for THIS sentence, e.g. "a farmer pouring water into a cracked clay pot", "a smartphone with a shopping cart on its screen". Describe the subject only — no style words, no text in the picture, no background. Each art description in a scene must be different and specific to the script.
"name" is a required fallback: the closest matching value from the list below, used only if the drawing cannot be produced.

IconName values (use these only):
"brain","bulb","box","stick","chart","star","ship","mountain","castle","mosque","crown","king","queen","sword","flag","tower","scroll","book","sun","tree","globe","scale","horse","shield","gear","heart","rocket","computer","person","money","clock","target","document","megaphone","cloud","phone","robot","leaf","fire","lock","key","chat","checkmark","cross","question","house","car","graph","pencil","camera","music","mail","calendar","search","settings","trophy","gift","bag","cart","bell","users","puzzle","plane","bolt","moon","coffee","smile","atom","flask","magnet","wand","battery","wifi","droplet","snowflake","umbrella","pizza","bicycle","factory","school","hospital"

Rules:
- Canvas is 1920x1080. Keep coordinates within x: 120..1800, y: 240..980. Reserve y < 220 for the title.
- Use a pure white scene with bold black cartoon outlines and a restrained flat-color palette. Do not request textures, realism, gradients, shadows, or decorative backgrounds.
- Build one clear visual argument per scene. Each scene is a self-contained frame lasting 8-14 seconds with a short heading and 3-6 supporting elements.
- Start each new scene 0.6s after the previous scene ends. Sequence elements 1.0-2.0s apart.
- Translate EACH sentence or claim into a literal visual metaphor. The title, icons, labels, arrows, and narration must describe the same idea. Never add generic filler icons.
- Compose icons as problem/cause/effect, before/after, input/process/output, a vertical list, or a 2x2 group. Keep generous whitespace and never overlap bounds.
- Use large icons (180-300), centers at least 360px apart, with labels directly below or beside them.
- Titles are 2-5 words, labels 1-3 words, callouts under 6 words, all uppercase-friendly. Never put paragraphs on canvas.
- Choose the closest content-specific icons: tech uses robot/computer/brain/cloud; business uses rocket/target/money/chart/users; education uses school/book/pencil/bulb; health uses hospital/heart/flask/person; security uses lock/key/shield; communication uses chat/mail/phone; history uses castle/crown/scroll/flag.
- Match the requested total duration. The final item's delay + duration must be inside the requested target window. Expand narration naturally to fill it.`;

export async function generateTimelineResult(data: z.infer<typeof timelineInputSchema>) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { error: "AI Gateway not configured." as const };

  const targetSeconds = Math.round(data.durationMinutes * 60);
  const minSec = Math.round(targetSeconds * 0.9);
  const maxSec = Math.round(targetSeconds * 1.1);
  const sceneCount = Math.max(3, Math.round(targetSeconds / 12));
  const minScenes = Math.max(3, sceneCount - 1);
  const maxScenes = sceneCount + 1;
  const itemMin = Math.max(20, Math.round(targetSeconds * 0.65));
  const itemMax = Math.round(targetSeconds * 1.05);
  const pacingHint = data.pacing === "slow"
    ? "Use 1.8-2.8s gaps and 12-16s scenes."
    : data.pacing === "fast"
      ? "Use 0.8-1.4s gaps and 7-10s scenes."
      : "Use 1.2-1.8s gaps and 10-12s scenes.";
  const durationHint = `TARGET: ${targetSeconds}s. Last item must end between ${minSec}s and ${maxSec}s. Build ${minScenes}-${maxScenes} scenes and ${itemMin}-${itemMax} items.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Style: ${data.style}. ${pacingHint}\n${durationHint}\n\nSCRIPT / TOPIC:\n${data.script}` },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    if (res.status === 429) return { error: "Rate limit hit. Try again shortly." as const };
    if (res.status === 402) return { error: "AI credits exhausted. Add credits in workspace settings." as const };
    console.error("AI gateway error", res.status, await res.text());
    return { error: `AI gateway error (${res.status}).` as const };
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  let parsed: { title?: string; narration?: string; items?: GeneratedItem[] };
  try {
    parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
  } catch {
    return { error: "AI returned malformed JSON." as const };
  }
  return {
    title: parsed.title ?? "Untitled",
    narration: parsed.narration ?? "",
    items: Array.isArray(parsed.items) ? parsed.items : [],
  };
}