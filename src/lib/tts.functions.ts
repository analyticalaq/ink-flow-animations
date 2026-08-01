import { createServerFn } from "@tanstack/react-start";

export const synthesizeTTS = createServerFn({ method: "POST" })
  .inputValidator((data: { text: string; voiceId: string; speed?: number }) => {
    if (!data?.text || typeof data.text !== "string") {
      throw new Error("text is required");
    }
    if (!data?.voiceId || typeof data.voiceId !== "string") {
      throw new Error("voiceId is required");
    }
    const speed =
      typeof data.speed === "number" && isFinite(data.speed)
        ? Math.max(0.7, Math.min(1.2, data.speed))
        : 1;
    return { text: data.text, voiceId: data.voiceId, speed };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ElevenLabs is not connected to this project");

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${data.voiceId}/with-timestamps?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: data.text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
            speed: data.speed,
          },
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      let message = err || `ElevenLabs TTS failed: ${res.status}`;
      try {
        const parsed = JSON.parse(err) as { detail?: { status?: string; message?: string } };
        if (parsed.detail?.status === "quota_exceeded") {
          message =
            "ElevenLabs credits exhausted — add credits to your ElevenLabs account (or use a shorter script) to generate this voiceover.";
        } else if (parsed.detail?.message) {
          message = parsed.detail.message;
        }
      } catch {
        // keep raw message
      }
      return { error: message, audioBase64: null, mime: null, alignment: null };
    }

    const json = (await res.json()) as {
      audio_base64: string;
      alignment?: {
        characters: string[];
        character_start_times_seconds: number[];
        character_end_times_seconds: number[];
      } | null;
    };
    return {
      error: null as string | null,
      audioBase64: json.audio_base64,
      mime: "audio/mpeg" as string | null,
      alignment: json.alignment ?? null,
    };
  });