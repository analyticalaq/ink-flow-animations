# Vertical (9:16) video option

Let the user pick the video shape before generating: Landscape 16:9 (1920x1080, current default) or Vertical 9:16 (1080x1920). The preview, the illustrations layout, and the exported file all follow the choice.

## What the user sees

- A new "Format" toggle next to Style/Length: Landscape 16:9 / Vertical 9:16.
- The preview frame changes shape immediately (tall, centered player for vertical) and the fullscreen view respects it too.
- Illustrations and text re-arrange for the taller frame: fewer, larger items stacked vertically instead of spread side by side; titles near the top, captions near the bottom.
- Download exports 1080x1920 MP4 when Vertical is selected, 1920x1080 otherwise.

## How it works

1. Canvas becomes size-aware: `WhiteboardCanvas` takes `width`/`height` props (defaults 1920x1080) instead of the hardcoded constants, and its `viewBox`, background texture and wrapper aspect ratio derive from them.
2. Layout is expressed for the active frame: the local script parser (`scriptToTimeline.ts`) receives the frame size and uses a vertical grid (single column, larger icons) when height > width; the AI planner prompt (`generateTimeline.server.ts`) is told the exact canvas size and layout rules for the chosen orientation, so generated x/y coordinates fit.
3. Export follows the frame: `exportVideo.ts` takes width/height as options rather than fixed constants, `ExportRenderer` mounts at the selected size, and codec config/canvas use those dimensions.
4. Studio state: a `format` state in `src/routes/index.tsx` (`"16:9" | "9:16"`) drives the canvas props, the generation calls, and the export. Changing format after generating re-lays out the existing timeline via the parser where possible, otherwise prompts a regenerate.

## Technical notes

- Files touched: `src/components/WhiteboardCanvas.tsx` (size props), `src/lib/scriptToTimeline.ts` (orientation-aware layout), `src/lib/generateTimeline.server.ts` + `.functions.ts` (pass canvas size into the prompt), `src/lib/exportVideo.ts` (dimension options), `src/components/ExportRenderer.tsx` (dimension props), `src/routes/index.tsx` (format toggle + wiring).
- Timing, narration, sync, and controls are untouched — only geometry changes.
- Vertical export uses 1080x1920 at 30 fps with the same bitrate and audio muxing path.
