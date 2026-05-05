import "server-only";

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { RoastAlignment, VoiceGender } from "@/types";

const MAX_TEXT_CHARS = 5000;

export function shouldUseElevenLabsTts(): boolean {
  const skip = process.env.SKIP_ELEVENLABS;
  const skipped = skip === "1" || skip === "true" || skip === "yes";
  if (skipped) return false;
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

export function resolveElevenLabsVoiceId(gender: VoiceGender): string {
  const maleId = process.env.ELEVENLABS_VOICE_ID_MALE?.trim();
  const femaleId = process.env.ELEVENLABS_VOICE_ID_FEMALE?.trim();
  const fallback = process.env.ELEVENLABS_VOICE_ID?.trim();

  const chosen = gender === "male" ? maleId ?? fallback : femaleId ?? fallback;

  if (!chosen) {
    throw new Error(
      "Missing ElevenLabs voice IDs. Set ELEVENLABS_VOICE_ID and/or ELEVENLABS_VOICE_ID_MALE / ELEVENLABS_VOICE_ID_FEMALE.",
    );
  }

  return chosen;
}

export async function synthesizeSpeechElevenLabs(
  text: string,
  voiceId: string
): Promise<{ audio: Buffer; alignment?: RoastAlignment }> {
  const trimmed = text.trim();
  const bodyText = trimmed.length <= MAX_TEXT_CHARS ? trimmed : trimmed.slice(0, MAX_TEXT_CHARS);

  const client = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY ?? "",
  });

  const modelId = process.env.ELEVENLABS_TTS_MODEL?.trim() ?? "eleven_turbo_v2_5";

  const result = await client.textToSpeech.convertWithTimestamps(voiceId, {
    text: bodyText,
    modelId,
    outputFormat: "mp3_44100_128",
  });

  const audioBuffer = Buffer.from(result.audioBase64, "base64");

  return {
    audio: audioBuffer,
    alignment: result.alignment ?? result.normalizedAlignment,
  };
}
