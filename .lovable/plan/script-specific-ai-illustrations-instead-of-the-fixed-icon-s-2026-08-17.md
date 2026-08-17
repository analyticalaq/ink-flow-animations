# Script-specific AI illustrations instead of the fixed icon set

Today every drawing on the board comes from a fixed library of ~80 built-in shapes, so two different scripts about very different topics end up reusing the same brain, bulb and rocket. This plan replaces that with illustrations the AI draws fresh for each scene of your script, in the same Simi look you approved (bold black outlines, flat solid colours, white board).

## How it will work

1. When a timeline is generated, each visual slot now carries a short **drawing brief** written from the actual sentence it illustrates (for example "a farmer pouring water into a cracked clay pot"), not an icon name.
2. A second AI pass turns each brief into **hand-drawn SVG line art** — plain paths and shapes, no photos — so it can still be revealed stroke by stroke with the existing pen-drawing animation.
3. Drawings are generated in parallel and **cached by brief text**, so replays and small edits do not re-generate everything.
4. If a drawing fails or the AI is unavailable, that slot falls back to the closest built-in icon so a video is always produced.
5. The "Auto-build (no AI)" path keeps using the built-in icons, unchanged.

You will see a short "drawing illustrations" progress state after script generation, before playback becomes available.

## What stays the same

- Simi style: white board, bold black outlines, flat colour fills, uppercase hand-drawn text.
- Scene timing, narration sync with ElevenLabs, progress bar, maximize.
- Layout rules: large art, generous spacing, short labels.

## Technical notes

- `src/lib/generateTimeline.server.ts`: the timeline schema gains an `art` field (a one-sentence subject description) on illustration items; the prompt asks for that description instead of an icon name, keeping `name` as an optional fallback hint.
- New `src/lib/generateArt.server.ts` + `generateArt.functions.ts`: calls the AI Gateway chat endpoint with a strict "return only SVG markup" system prompt — viewBox `0 0 200 200`, black strokes of uniform width, flat fills from a small palette, no gradients/shadows/text/images. Output is sanitised (allowlist of `path/circle/rect/line/polyline/polygon/ellipse/g` and safe attributes; strip scripts, styles, external refs) before it ever reaches the DOM.
- Requests run batched with a concurrency cap and an in-memory + `sessionStorage` cache keyed by a hash of the brief. No client-side abort timers on Gateway calls.
- `src/components/WhiteboardCanvas.tsx`: new `"art"` timeline item type that mounts the sanitised SVG group, scales it to the item's `size`, and applies the existing stroke-dashoffset reveal across its child paths (measured with `getTotalLength`, sequenced like the current multi-part icons). Rough.js wobble filter still applies. `"icon"` items keep working untouched.
- `src/routes/index.tsx`: after the timeline returns, resolve art for every `art` item, show a generation progress indicator, and swap any failed item to `{ type: "icon", name }`.
