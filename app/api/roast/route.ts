import { NextResponse } from "next/server";

import { generateRoast } from "@/lib/claude";
import { shouldUseElevenLabsTts, resolveElevenLabsVoiceId, synthesizeSpeechElevenLabs } from "@/lib/elevenlabs";
import { synthesizeRoastSpeech as synthesizeRoastSpeechNoiz } from "@/lib/noiz";
import { scrapeAmazonProduct } from "@/lib/scraper";
import type { ApiResponse, RoastMode, VoiceGender } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODES: RoastMode[] = ["standard", "harder", "reRoast"];

function isRoastMode(value: unknown): value is RoastMode {
  return typeof value === "string" && (MODES as string[]).includes(value);
}

function parseVoiceGender(raw: unknown): VoiceGender {
  return raw === "male" ? "male" : "female";
}

/** When set, skips external TTS (still returns roast text). */
function skipTts(): boolean {
  const v = process.env.SKIP_TTS;
  return v === "1" || v === "true" || v === "yes";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: unknown; mode?: unknown; voiceGender?: unknown };
    const url = typeof body.url === "string" ? body.url : "";
    const mode: RoastMode = isRoastMode(body.mode) ? body.mode : "standard";
    const voiceGender = parseVoiceGender(body.voiceGender);

    if (!url.trim()) {
      return NextResponse.json({ error: "Missing url." }, { status: 400 });
    }

    const product = await scrapeAmazonProduct(url);
    const { roast, verdict, badges } = await generateRoast(product, mode);

    const skip = skipTts();
    let audioBase64 = "";
    /** Character timings when ElevenLabs returns them */
    let alignment: ApiResponse["alignment"];
    /** Which provider produced audio */
    let ttsProvider: NonNullable<ApiResponse["ttsProvider"]> | undefined;

    if (!skip) {
      if (shouldUseElevenLabsTts()) {
        try {
          const voiceId = resolveElevenLabsVoiceId(voiceGender);
          const { audio, alignment: al } = await synthesizeSpeechElevenLabs(roast, voiceId);
          audioBase64 = audio.toString("base64");
          alignment = al ?? null;
          ttsProvider = "elevenlabs";
        } catch (e) {
          const msg = e instanceof Error ? e.message : "ElevenLabs TTS failed.";
          console.error("[tts] elevenlabs fallback to noiz:", msg);

          try {
            const audioBuffer = await synthesizeRoastSpeechNoiz(roast);
            audioBase64 = audioBuffer.toString("base64");
            alignment = null;
            ttsProvider = "noiz";
          } catch (fallbackErr) {
            const fb = fallbackErr instanceof Error ? fallbackErr.message : "Noiz TTS failed.";
            throw new Error(`Voice generation failed (${msg}). Fallback Noiz failed: ${fb}`);
          }
        }
      } else {
        const audioBuffer = await synthesizeRoastSpeechNoiz(roast);
        audioBase64 = audioBuffer.toString("base64");
        alignment = null;
        ttsProvider = "noiz";
      }
    }

    const payload: ApiResponse = {
      product,
      roast,
      verdict,
      badges,
      audio: audioBase64,
      alignment: alignment ?? null,
      ...(ttsProvider ? { ttsProvider } : {}),
      ttsSkipped: skip,
    };

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    const status = message.includes("Invalid") || message.includes("Only Amazon") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
