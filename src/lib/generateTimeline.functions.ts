import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  script: z.string().min(5).max(8000),
  style: z.enum(["explainer", "story", "lecture", "pitch"]).default("explainer"),
  pacing: z.enum(["slow", "normal", "fast"]).default("normal"),
  /** Target video length in minutes (1-10). The AI will scale scene count and pacing accordingly. */
  durationMinutes: z.number().min(1).max(10).default(2),
});

const SYSTEM_PROMPT = `You are an animation director that converts a script or topic
into a clean, multi-scene HAND-DRAWN WHITEBOARD explainer timeline in the Lamina Labs / Simi style.

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
"question","house","car","graph","pencil","camera","music",
"mail","calendar","search","settings","trophy","gift","bag","cart","bell","users",
"puzzle","plane","bolt","moon","coffee","smile","atom","flask","magnet","wand",
"battery","wifi","droplet","snowflake","umbrella","pizza","bicycle","factory","school","hospital"

Rules:
- Canvas is 1920x1080. Keep coordinates within x: 120..1800, y: 240..980. Reserve y < 220 for the title.
- Use a pure white scene with bold black cartoon outlines and a restrained flat-color palette. Do not request textures, realism, gradients, shadows, or decorative backgrounds.
- Build one clear visual argument per scene. Each scene is a self-contained frame lasting 8-14 seconds with a short heading and 3-6 supporting elements.
- For each new scene, start its first item's delay 0.6s after the previous scene ends. The renderer auto-fades the old scene out.
- Within a scene, sequence delays 1.0-2.0s apart so the viewer can comfortably follow each stroke (smoother pacing).
- Each scene MUST include one short title (2-5 words), 3-6 icons with labels, and only arrows or text callouts that clarify a relationship. Avoid clutter.
- Translate EACH sentence or claim into a literal visual metaphor. The scene title, icons, labels, arrows, and narration segment must describe the same idea. Never add a generic icon just to fill space.
- Compose icons as simple diagrams: problem/cause/effect, before/after, input/process/output, or a 2x2 group. Keep generous whitespace and avoid overlapping icon, label, title, arrow, and text bounds.
- Use large icons (180-300). Keep icon centers at least 360px apart. Put labels directly below or beside their icon and keep them to 1-3 words.
- Pick icons that visually match the content of the script. Every key noun, verb, or concept must map to the closest icon from the list. Use the topic to guide selection:
  • Tech/AI/software → robot, computer, brain, atom, bolt, gear, cloud, wifi, code (use document), chart
  • Business/startup → rocket, target, money, chart, graph, trophy, users, megaphone, bag, briefcase (use bag)
  • Education/learning → school, book, pencil, bulb, brain, scroll, document, question
  • Health/medical → hospital, heart, flask, droplet, smile, person
  • Travel/transport → plane, car, ship, bicycle, globe, mountain, sun, umbrella
  • Daily life → coffee, pizza, house, gift, calendar, clock, phone, mail, music, camera, bell, cart
  • Science → atom, flask, magnet, bolt, droplet, leaf, snowflake, moon, sun, globe
  • Security/privacy → lock, key, shield, checkmark, cross
  • Communication → chat, mail, megaphone, phone, bell, wifi
  • History/culture → ship, castle, mosque, crown, king, queen, sword, scroll, horse, tower, flag
  Avoid using historical icons for modern topics and vice-versa.
- Keep text SHORT and uppercase-friendly: titles 2-5 words, labels 1-3 words, text callouts under 6 words. Never emit paragraphs on the canvas.
- Total duration is specified per request (see user message). Use as many items as needed to fill that duration. Verify the last item's (delay + duration) matches the requested target window.
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

    const targetSeconds = Math.round(data.durationMinutes * 60);
    const minSec = Math.round(targetSeconds * 0.9);
    const maxSec = Math.round(targetSeconds * 1.1);
    // Scale scenes and item counts with duration. ~10s per scene baseline.
    const sceneCount = Math.max(3, Math.round(targetSeconds / 10));
    const minScenes = Math.max(3, sceneCount - 2);
    const maxScenes = sceneCount + 2;
    const itemMin = Math.max(20, Math.round(targetSeconds * 0.8));
    const itemMax = Math.round(targetSeconds * 1.4);

    const pacingHint =
      data.pacing === "slow"
        ? "Use generous delays (1.8-2.8s between items) and longer scenes (12-16s each)."
        : data.pacing === "fast"
        ? "Use tight delays (0.8-1.4s between items) and snappier scenes (7-10s each)."
        : "Use moderate delays (~1.2-1.8s between items) and balanced scenes (10-12s each).";

    const durationHint = `TARGET TOTAL DURATION: ${targetSeconds} seconds (${data.durationMinutes} minute${data.durationMinutes === 1 ? "" : "s"}). The last item's (delay + duration) MUST be between ${minSec} and ${maxSec}. Build ${minScenes}-${maxScenes} scenes. Produce ${itemMin}-${itemMax} total items. Expand the narration to fill the full duration with rich detail, examples, and transitions.`;

    const userPrompt = `Style: ${data.style}. ${pacingHint}\n${durationHint}\n\nSCRIPT / TOPIC:\n${data.script}`;

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
