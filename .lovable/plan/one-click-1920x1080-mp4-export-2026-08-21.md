# One-click 1920x1080 MP4 export

Add a single "Download MP4" action that renders the exact preview — same timing, same fonts, same illustrations — into a 1920x1080 H.264 file with the ElevenLabs narration baked in.

## Why the old export broke

The previous attempt screenshotted the live DOM, so CSS animations restarted per frame and web fonts fell back to system fonts. The renderer now takes a `currentTimeMs` prop and seeks every animation deterministically, so a frame at time T can be reproduced exactly. The export is rebuilt on top of that.

## What the user sees

- A "Download MP4" button next to the fullscreen control, enabled once an animation is generated.
- Clicking it shows a progress bar ("Rendering 34% — 0:18 / 0:52") with a Cancel button; playback is paused during export.
- When done, the browser downloads `<title>.mp4` (1920x1080, 30 fps, narration included).
- If the browser can't encode H.264, it falls back to a `.webm` download and says so once.

## How it works

1. Render an offscreen copy of the whiteboard at exactly 1920x1080, driven by `currentTimeMs` only (no live playback, no audio element).
2. For each frame (30 fps over the audio duration, or the timeline duration when there is no voiceover):
   - set the frame time, let React commit,
   - serialize the SVG with the Caveat/Kalam/Patrick Hand fonts inlined as base64 `@font-face` rules so text renders identically,
   - draw it into a 1920x1080 offscreen canvas.
3. Encode frames with `VideoEncoder` (avc1, 8 Mbps) and mux with `mp4-muxer`; fall back to VP9 + `webm-muxer` where H.264 isn't available.
4. Decode the narration MP3 into PCM, encode it with `AudioEncoder` (AAC) and mux it as the audio track so voice and visuals stay in the sync already established by the timestamp-anchored scenes.
5. Yield to the event loop between frames so the UI stays responsive, and honour Cancel by tearing down the encoders.

## Technical notes

- New `src/lib/exportVideo.ts`: font inlining, SVG-to-canvas frame capture, video/audio encoding, muxing, cancellation.
- New `src/components/ExportRenderer.tsx`: hidden fixed-size 1920x1080 mount of `WhiteboardCanvas` used only for export.
- `src/routes/index.tsx`: export button, progress/cancel state, wiring to the cached narration blob.
- Uses the already-installed `mp4-muxer` / `webm-muxer`; `html-to-image` is no longer needed for this path.
- Frame time is derived from the same `audioTimeMs` clock the preview uses, so exported timing matches the preview exactly.
