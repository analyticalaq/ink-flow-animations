import type { IconName, TimelineItem } from "@/components/WhiteboardCanvas";

/**
 * Deterministic, AI-free script parser.
 * Splits the script into sentences/scenes, extracts key nouns, maps them to
 * the closest illustration icon and lays them out on the 1920x1080 canvas
 * with arrows and labels.
 */

const KEYWORD_ICONS: Array<[RegExp, IconName]> = [
  [/\b(ai|artificial intelligence|machine learning|ml|neural|model|think|thought|mind|idea|learn)\b/i, "brain"],
  [/\b(idea|insight|discover|aha|inspiration|innovat)/i, "bulb"],
  [/\b(data|stat|metric|number|analytic)/i, "chart"],
  [/\b(growth|revenue|trend|increase|kpi|graph)/i, "graph"],
  [/\b(rocket|launch|startup|liftoff|fast|accelerat)/i, "rocket"],
  [/\b(target|goal|aim|objective|focus)/i, "target"],
  [/\b(money|cash|dollar|price|cost|budget|profit|pay|salary|fund)/i, "money"],
  [/\b(time|hour|minute|second|deadline|schedul|when)/i, "clock"],
  [/\b(calendar|date|day|week|month|year)/i, "calendar"],
  [/\b(team|community|user|customer|audience|group|crowd|everyone|people)/i, "users"],
  [/\b(person|human|individual|someone|developer|designer|engineer|founder|worker|employee)\b/i, "person"],
  [/\b(computer|laptop|software|app|web|website|code|program|tech)/i, "computer"],
  [/\b(robot|automat|bot|agent)/i, "robot"],
  [/\b(cloud|saas|server|hosting|backend)/i, "cloud"],
  [/\b(phone|mobile|call|sms|text)/i, "phone"],
  [/\b(mail|email|inbox|message|newsletter)/i, "mail"],
  [/\b(chat|conversation|talk|dialog|comment)/i, "chat"],
  [/\b(megaphone|announce|market|promot|advertis|broadcast)/i, "megaphone"],
  [/\b(bell|notify|notification|alert|remind)/i, "bell"],
  [/\b(wifi|network|connect|internet|online)/i, "wifi"],
  [/\b(lock|secure|privacy|protect|encrypt)/i, "lock"],
  [/\b(key|password|access|token|credential)/i, "key"],
  [/\b(shield|safe|defend|guard)/i, "shield"],
  [/\b(checkmark|done|complete|success|approved)/i, "checkmark"],
  [/\b(wrong|fail|error|reject|cross)/i, "cross"],
  [/\b(question|ask|unknown|confus|unclear|mystery)/i, "question"],
  [/\b(search|find|look|explore|discover)/i, "search"],
  [/\b(setting|config|option|preference|tune)/i, "settings"],
  [/\b(trophy|win|award|champion|first)/i, "trophy"],
  [/\b(gift|present|reward|bonus|surprise)/i, "gift"],
  [/\b(bag|briefcase|business|company|firm|enterprise|corporate)/i, "bag"],
  [/\b(cart|shop|buy|store|ecommerce|purchase|order)/i, "cart"],
  [/\b(puzzle|solve|problem|challenge|complex)/i, "puzzle"],
  [/\b(plane|fly|travel|flight|airport)/i, "plane"],
  [/\b(car|drive|vehicle|road|traffic|uber)/i, "car"],
  [/\b(bicycle|bike|cycle)/i, "bicycle"],
  [/\b(ship|boat|sail|voyage|sea|navy)/i, "ship"],
  [/\b(globe|world|earth|global|international|countr|map)/i, "globe"],
  [/\b(mountain|peak|hike|summit|climb)/i, "mountain"],
  [/\b(tree|forest|nature|wood)/i, "tree"],
  [/\b(leaf|eco|green|plant|sustain)/i, "leaf"],
  [/\b(sun|sunny|solar|warm|bright|light)/i, "sun"],
  [/\b(moon|night|sleep|dark)/i, "moon"],
  [/\b(snow|cold|winter|freez)/i, "snowflake"],
  [/\b(umbrella|rain|weather|wet)/i, "umbrella"],
  [/\b(droplet|water|liquid|hydrat)/i, "droplet"],
  [/\b(fire|burn|hot|flame|passion)/i, "fire"],
  [/\b(bolt|energy|power|electric|lightning|speed)/i, "bolt"],
  [/\b(battery|charge)/i, "battery"],
  [/\b(magnet|attract|pull)/i, "magnet"],
  [/\b(atom|physics|particle|quantum|science)/i, "atom"],
  [/\b(flask|chemistry|lab|experiment|test)/i, "flask"],
  [/\b(wand|magic|spell)/i, "wand"],
  [/\b(coffee|cafe|drink|brew|morning)/i, "coffee"],
  [/\b(pizza|food|eat|meal|restaurant|hungry)/i, "pizza"],
  [/\b(smile|happy|joy|positive|emotion)/i, "smile"],
  [/\b(heart|love|care)/i, "heart"],
  [/\b(hospital|doctor|clinic|medical|health|patient|nurse)/i, "hospital"],
  [/\b(school|class|student|study|teach|university|college)/i, "school"],
  [/\b(factory|manufactur|industry|product)/i, "factory"],
  [/\b(house|home|building|live|residence|apartment)/i, "house"],
  [/\b(book|read|chapter|novel|library)/i, "book"],
  [/\b(document|file|report|paper|article|pdf|essay)/i, "document"],
  [/\b(scroll|history|ancient|old|tradition)/i, "scroll"],
  [/\b(pencil|write|draw|note|sketch|design)/i, "pencil"],
  [/\b(camera|photo|picture|snap|shoot|capture)/i, "camera"],
  [/\b(music|song|sound|audio|tune|melody)/i, "music"],
  [/\b(gear|process|machine|engine|mechan|system)/i, "gear"],
  [/\b(scale|balance|judge|weigh|fair|justice|law)/i, "scale"],
  [/\b(star|favorite|popular|rating|review)/i, "star"],
  [/\b(flag|country|nation|patriot|signal)/i, "flag"],
  [/\b(crown|royal|elite|premium)/i, "crown"],
  [/\b(castle|kingdom|medieval|fort)/i, "castle"],
  [/\b(tower|skyscraper|landmark)/i, "tower"],
  [/\b(horse|ride|cavalry|stallion)/i, "horse"],
  [/\b(sword|fight|battle|warrior|combat)/i, "sword"],
];

const STOPWORDS = new Set(
  "the a an and or but if then so to of in on at by for with from is are was were be been being it this that these those as into about over under your you me my we our their they them he she his her i".split(" "),
);

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function pickIconsForText(text: string, max: number): Array<{ icon: IconName; label: string }> {
  const found: Array<{ icon: IconName; label: string }> = [];
  const seen = new Set<IconName>();
  for (const [re, icon] of KEYWORD_ICONS) {
    if (seen.has(icon)) continue;
    const m = text.match(re);
    if (m) {
      seen.add(icon);
      const raw = m[0].toLowerCase();
      const label = /artificial intelligence/i.test(raw)
        ? "AI"
        : /machine learning/i.test(raw)
          ? "learning"
          : raw;
      found.push({ icon, label });
      if (found.length >= max) break;
    }
  }
  if (!found.length) {
    const words = text
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w));
    const uniq = Array.from(new Set(words)).slice(0, max);
    const generic: IconName[] = ["bulb", "chart", "target", "gear", "star"];
    uniq.forEach((w, i) => found.push({ icon: generic[i % generic.length], label: w }));
  }
  return found.slice(0, max);
}

function makeTitle(sentence: string): string {
  const cleaned = sentence
    .replace(/^\s*(explain|describe|show|tell me about)\s+/i, "")
    .replace(/artificial intelligence/gi, "AI")
    .replace(/\s+in\s+simple\s+terms.*$/i, "")
    .replace(/[.,;:]$/g, "")
    .trim();
  const embeddedQuestion = cleaned.match(/^what\s+(.+?)\s+is[?!.]?$/i);
  if (embeddedQuestion) return `What is ${embeddedQuestion[1]}`;
  const question = cleaned.match(/^(what|how|why)\s+(.+?)(?:\s+in\s+simple\s+terms)?[?!.]?$/i);
  if (question) return `${question[1]} ${question[2]}`.split(/\s+/).slice(0, 5).join(" ");
  return cleaned.split(/\s+/).filter(Boolean).slice(0, 5).join(" ").replace(/[.,;:!?]$/, "");
}

function chunkScenes(sentences: string[], targetScenes: number): string[][] {
  if (!sentences.length) return [];
  const per = Math.max(1, Math.ceil(sentences.length / targetScenes));
  const out: string[][] = [];
  for (let i = 0; i < sentences.length; i += per) out.push(sentences.slice(i, i + per));
  return out;
}

export function buildTimelineFromScript(
  script: string,
  opts: {
    durationMinutes?: number;
    pacing?: "slow" | "normal" | "fast";
    width?: number;
    height?: number;
  } = {},
): { title: string; narration: string; items: TimelineItem[] } {
  const durationMinutes = opts.durationMinutes ?? 2;
  const pacing = opts.pacing ?? "normal";
  const W = opts.width ?? 1920;
  const H = opts.height ?? 1080;
  const vertical = H > W;
  const targetSeconds = durationMinutes * 60;
  const sentences = splitSentences(script);
  const targetScenes = Math.max(3, Math.min(40, Math.round(targetSeconds / 12)));
  const sceneChunks = chunkScenes(sentences.length ? sentences : [script], targetScenes);

  const sceneDuration = targetSeconds / Math.max(1, sceneChunks.length);
  const baseGap = pacing === "slow" ? 2.2 : pacing === "fast" ? 1.0 : 1.5;

  const items: TimelineItem[] = [];
  let cursor = 0;

  sceneChunks.forEach((chunk, sceneIdx) => {
    const sceneText = chunk.join(" ");
    const sceneStart = cursor;
    const iconCount = Math.min(4, Math.max(3, splitSentences(sceneText).length + 2));
    const picks = pickIconsForText(sceneText, iconCount);

    items.push({
      type: "title",
      content: makeTitle(chunk[0] ?? sceneText) || `Scene ${sceneIdx + 1}`,
      delay: sceneStart,
      duration: 1.4,
      scene: sceneIdx,
    });

    // Fractional layouts so they work for both 16:9 and 9:16 canvases.
    const layoutsWide = [
      [[0.224, 0.463], [0.5, 0.463], [0.776, 0.463], [0.5, 0.741]],
      [[0.271, 0.426], [0.729, 0.426], [0.271, 0.741], [0.729, 0.741]],
      [[0.208, 0.602], [0.417, 0.435], [0.625, 0.435], [0.833, 0.602]],
    ] as const;
    const layoutsTall = [
      [[0.5, 0.26], [0.5, 0.45], [0.5, 0.64], [0.5, 0.82]],
      [[0.3, 0.3], [0.7, 0.3], [0.3, 0.62], [0.7, 0.62]],
      [[0.5, 0.28], [0.29, 0.52], [0.71, 0.52], [0.5, 0.76]],
    ] as const;
    const pool = vertical ? layoutsTall : layoutsWide;
    const layout = pool[sceneIdx % pool.length].map(
      ([fx, fy]) => [Math.round(fx * W), Math.round(fy * H)] as const,
    );
    const xs = picks.map((_, i) => layout[i][0]);
    const ys = picks.map((_, i) => layout[i][1]);

    picks.forEach((p, i) => {
      const at = sceneStart + 1.8 + i * baseGap;
      items.push({
        type: "icon",
        name: p.icon,
        x: xs[i],
        y: ys[i],
        size: Math.round((vertical ? 0.24 * W : 0.109 * W) + ((i * 19) % 45)),
        label: p.label,
        delay: at,
        duration: 1.4,
        scene: sceneIdx,
      });
      if (i > 0) {
        const gap = Math.round(W * 0.057);
        const sameRow = Math.abs(ys[i] - ys[i - 1]) < 40;
        items.push({
          type: "arrow",
          from: sameRow ? [xs[i - 1] + gap, ys[i - 1]] : [xs[i - 1], ys[i - 1] + gap],
          to: sameRow ? [xs[i] - gap, ys[i]] : [xs[i], ys[i] - gap],
          delay: at - baseGap * 0.35,
          duration: 0.7,
          scene: sceneIdx,
        });
      }
    });

    const calloutSource = chunk[1] ?? "";
    const callout = calloutSource
      ? calloutSource.split(/\s+/).slice(0, 6).join(" ").replace(/[.,;:!?]$/, "")
      : "";
    if (callout) {
      const calloutY = Math.round(H * (picks.length > 3 ? 0.884 : 0.833));
      items.push({
        type: "text",
        content: callout,
        x: Math.round(W / 2),
        y: calloutY,
        size: 44,
        align: "center",
        delay: sceneStart + 1.8 + picks.length * baseGap + 0.3,
        duration: 1.0,
        scene: sceneIdx,
      });
    }

    cursor = sceneStart + sceneDuration;
  });

  const last = items.reduce((m, it) => {
    const dur = "duration" in it && typeof it.duration === "number" ? it.duration : 1.2;
    return Math.max(m, (it.delay ?? 0) + dur);
  }, 0);
  if (last < targetSeconds - 2) {
    items.push({
      type: "caption",
      content: "the end",
      position: "bottom-right",
      delay: targetSeconds - 1.5,
      duration: 1.2,
      scene: sceneChunks.length - 1,
    });
  }

  const title = makeTitle(sentences[0] ?? script) || "Untitled";
  const narration = sentences.join(" ");

  return { title, narration, items };
}
