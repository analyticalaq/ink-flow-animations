# Fix vertical (9:16) export: speed and failed download

Vertical exports currently take very long and then fail instead of producing a file. The plan makes the renderer much faster, makes encoding robust for portrait sizes, and surfaces the real error instead of a generic failure.

## What was verified

- The export loop re-serializes the whole SVG every frame, reading computed styles and bounding boxes node by node, and calls `videoEncoder.flush()` every 8 frames. At 30 fps this is thousands of full-DOM passes — this is the source of the long render.
- Codec choice is fixed at `avc1.640028` (H.264 level 4.0) regardless of orientation, with a single VP9 fallback and no per-frame error surfacing; encoder errors currently end as a generic "Export failed".
- The finished video is assembled fully in memory (`ArrayBufferTarget`) and then copied again into a `Blob`, so long vertical renders double peak memory before the download starts.

The exact browser-side error message hasn't been captured yet, so step 1 is to surface it rather than guess.

## What the user will see

- Vertical export finishes in a fraction of the current time, with a progress bar that keeps moving.
- A file actually downloads at 1080x1920; if the browser can't do H.264 it still downloads a `.webm` and says so.
- If something does fail, the message names the real cause (e.g. "encoder rejected 1080x1920") instead of a generic failure.

## Plan

1. **Surface the real error.** Reject the export promise with the encoder's own error text (video and audio encoder `error` callbacks, plus muxer failures), and log it. Show that text in the toast.
2. **Make codec selection size-aware.** Probe a list of H.264 profiles/levels for the actual width/height (level 4.0 → 4.2 → 5.0/5.1, baseline variants), pick the first supported one, and fall back to VP9/WebM only when none work. Probe the AAC config too and drop the audio track (or switch to Opus/WebM) when AAC isn't supported, instead of failing at mux time.
3. **Speed up frame capture.**
   - Serialize the SVG structure once; per frame only update the values that actually change, and skip the per-node `getBoundingClientRect()` layout thrash by computing the clip-rect width from the animation clock.
   - Drop the `flush()` every 8 frames; instead await the encoder's `dequeue` event only when the queue grows past a threshold.
   - Decode each frame's SVG with `createImageBitmap` into an `OffscreenCanvas` instead of an `Image` + on-screen canvas.
   - Keyframe every 2 s stays, but bitrate scales with pixel count so portrait isn't over-encoded.
4. **Reduce peak memory.** Hand the muxer buffer directly to the `Blob` without an extra copy, and cap the default export bitrate for long videos so a 5–10 minute vertical render doesn't exhaust memory before download.
5. **Verify** by driving the app headlessly: generate a short animation, switch to Vertical, export, and confirm a non-empty 1080x1920 file with the expected duration and audio track.

## Technical notes

- Files touched: `src/lib/exportVideo.ts` (codec probing, frame pipeline, error propagation, memory), `src/routes/index.tsx` (error toast text only).
- No changes to timeline generation, narration, or the preview renderer.
