import "server-only";

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { RoastAlignment, VoiceGender } from "@/types";

const MAX_TEXT_CHARS = 5000;
type ElevenLabsOutputFormat = Parameters<
  ElevenLabsClient["textToSpeech"]["convertWithTimestamps"]
>[1]["outputFormat"];

export function shouldUseElevenLabsTts(apiKey?: string): boolean {
  return Boolean(apiKey?.trim());
}

export function resolveElevenLabsVoiceId(gender: VoiceGender, maleId?: string, femaleId?: string): string {
  const chosen = gender === "male" ? maleId : femaleId;

  if (!chosen) {
    throw new Error("Missing ElevenLabs voice IDs in settings.");
  }

  return chosen;
}

export async function synthesizeSpeechElevenLabs(
  text: string,
  voiceId: string,
  opts: {
    apiKey: string;
    modelId?: string;
    outputFormat?: ElevenLabsOutputFormat;
  }
): Promise<{ audio: Buffer; alignment?: RoastAlignment }> {
  const trimmed = text.trim();
  const bodyText = trimmed.length <= MAX_TEXT_CHARS ? trimmed : trimmed.slice(0, MAX_TEXT_CHARS);

  const effectiveApiKey = opts.apiKey?.trim();
  if (!effectiveApiKey) {
    throw new Error("Missing ElevenLabs API key in settings");
  }

  const client = new ElevenLabsClient({
    apiKey: effectiveApiKey,
  });

  const modelId = opts.modelId?.trim() || "eleven_turbo_v2_5";
  const outputFormat = opts.outputFormat ?? "mp3_44100_128";

  const result = await client.textToSpeech.convertWithTimestamps(voiceId, {
    text: bodyText,
    modelId,
    outputFormat,
  });

  const audioBuffer = Buffer.from(result.audioBase64, "base64");

  return {
    audio: audioBuffer,
    alignment: result.alignment ?? result.normalizedAlignment,
  };
}
