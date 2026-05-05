import { NextResponse } from "next/server";

import { generateRoast } from "@/lib/roast-engine";
import { shouldUseElevenLabsTts, synthesizeSpeechElevenLabs } from "@/lib/primary-tts";
import { synthesizeRoastSpeech as synthesizeRoastSpeechNoiz } from "@/lib/fallback-tts";
import { scrapeAmazonProduct } from "@/lib/scraper";
import type { ApiResponse, RoastMode, VoiceGender } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODES: RoastMode[] = ["standard", "harder", "reRoast"];
const FALLBACK_LIMIT_COOKIE = "fallback_roast_count";
const FALLBACK_LIMIT_MAX = 2;

function isRoastMode(value: unknown): value is RoastMode {
  return typeof value === "string" && (MODES as string[]).includes(value);
}

function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_EXECUTION_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function isLocalhostUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function getFallbackCountFromCookie(request: Request): number {
  const cookie = request.headers.get("cookie") ?? "";
  const parts = cookie.split(";").map((v) => v.trim());
  const raw = parts.find((p) => p.startsWith(`${FALLBACK_LIMIT_COOKIE}=`));
  const n = Number(raw?.split("=")[1] ?? "0");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** When set, skips external TTS (still returns roast text). */
function skipTts(): boolean {
  const v = process.env.SKIP_TTS;
  return v === "1" || v === "true" || v === "yes";
}

/** User-provided settings interface */
interface UserSettings {
  ollamaModel?: string;
  ollamaBaseUrl?: string;
  llmApiKey?: string;
  llmApiBaseUrl?: string;
  roastMode?: RoastMode;
  roastLanguage?: "english" | "hindi" | "hinglish";
  narratorPersona?: "brenda" | "brandon";
  elevenLabsApiKey?: string;
  elevenLabsVoiceIdFemale?: string;
  elevenLabsVoiceIdMale?: string;
  elevenLabsTtsModelId?: string;
  noizApiKey?: string;
  noizVoiceIdFemale?: string;
  noizVoiceIdMale?: string;
  noizVoiceId?: string;
  noizOutputFormat?: string;
  noizSpeed?: string;
  noizQualityPreset?: string;
}

type SourceTag = "settings" | "env" | "default";

function hasValue(v: string | undefined): boolean {
  return Boolean(v && v.trim());
}

function pickWithSource(
  settingValue: string | undefined,
  envValue: string | undefined,
  defaultValue = ""
): { value: string; source: SourceTag } {
  if (hasValue(settingValue)) return { value: settingValue!.trim(), source: "settings" };
  if (hasValue(envValue)) return { value: envValue!.trim(), source: "env" };
  return { value: defaultValue, source: "default" };
}

/** Get effective settings - use dialog values for keys/voices only */
function getEffectiveSettings(userSettings?: UserSettings) {
  const modelPicked = pickWithSource(userSettings?.ollamaModel, undefined, "gemma4:e2b");
  const baseUrlPicked = pickWithSource(
    userSettings?.ollamaBaseUrl,
    undefined,
    ""
  );
  const model = modelPicked.value;
  const baseUrl = baseUrlPicked.value;
  const llmApiKeyPicked = pickWithSource(userSettings?.llmApiKey, process.env.LLM_API_KEY, "");
  const llmApiBaseUrlPicked = pickWithSource(
    userSettings?.llmApiBaseUrl,
    process.env.LLM_API_BASE_URL,
    "https://openrouter.ai/api/v1"
  );

  const elevenLabsKeyPicked = pickWithSource(
    userSettings?.elevenLabsApiKey,
    process.env.ELEVENLABS_API_KEY,
    ""
  );
  const noizKeyPicked = pickWithSource(userSettings?.noizApiKey, process.env.NOIZ_API_KEY, "");

  const elevenFemaleVoicePicked = pickWithSource(
    userSettings?.elevenLabsVoiceIdFemale,
    process.env.ELEVENLABS_VOICE_ID_FEMALE || process.env.ELEVENLABS_VOICE_ID,
    ""
  );
  const elevenMaleVoicePicked = pickWithSource(
    userSettings?.elevenLabsVoiceIdMale,
    process.env.ELEVENLABS_VOICE_ID_MALE || process.env.ELEVENLABS_VOICE_ID,
    ""
  );

  const elevenModelIdPicked = pickWithSource(
    userSettings?.elevenLabsTtsModelId,
    process.env.ELEVENLABS_TTS_MODEL,
    "eleven_turbo_v2_5"
  );
  const noizFemaleVoicePicked = pickWithSource(
    userSettings?.noizVoiceIdFemale,
    process.env.NOIZ_VOICE_ID_FEMALE || process.env.NOIZ_VOICE_ID,
    ""
  );
  const noizMaleVoicePicked = pickWithSource(
    userSettings?.noizVoiceIdMale,
    process.env.NOIZ_VOICE_ID_MALE || process.env.NOIZ_VOICE_ID,
    ""
  );
  const noizLegacyVoicePicked = pickWithSource(userSettings?.noizVoiceId, process.env.NOIZ_VOICE_ID, "");

  const noizOutputFormat = userSettings?.noizOutputFormat?.trim() || process.env.NOIZ_TTS_OUTPUT_FORMAT || "mp3";
  const noizSpeed = userSettings?.noizSpeed?.trim() || process.env.NOIZ_TTS_SPEED || "1";
  const noizQualityPreset = userSettings?.noizQualityPreset?.trim() || process.env.NOIZ_TTS_QUALITY_PRESET || "3";

  return {
    // If user targets local Ollama but model is a cloud-tagged alias, switch to local-safe default.
    ollamaModel:
      (baseUrl.includes("127.0.0.1") || baseUrl.includes("localhost")) && model.endsWith(":cloud")
        ? "gemma4:e2b"
        : model,
    ollamaBaseUrl: baseUrl,
    __source: {
      ollamaModel: modelPicked.source,
      ollamaBaseUrl: baseUrlPicked.source,
    },
    roastLanguage: userSettings?.roastLanguage || "english",
    roastMode: userSettings?.roastMode || "standard",
    narratorPersona: userSettings?.narratorPersona === "brandon" ? "brandon" : "brenda",
    llmApiKey: llmApiKeyPicked.value,
    llmApiBaseUrl: llmApiBaseUrlPicked.value,
    elevenLabsApiKey: elevenLabsKeyPicked.value,
    elevenLabsVoiceIdFemale: elevenFemaleVoicePicked.value,
    elevenLabsVoiceIdMale: elevenMaleVoicePicked.value,
    elevenLabsTtsModelId: elevenModelIdPicked.value,
    noizApiKey: noizKeyPicked.value,
    noizVoiceIdFemale: noizFemaleVoicePicked.value,
    noizVoiceIdMale: noizMaleVoicePicked.value,
    noizVoiceId: noizLegacyVoicePicked.value,
    noizOutputFormat,
    noizSpeed,
    noizQualityPreset,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: unknown; mode?: unknown; settings?: UserSettings };
    const url = typeof body.url === "string" ? body.url : "";
    const requestedMode = isRoastMode(body.mode) ? body.mode : "standard";
    const userSettings = body.settings;

    if (!url.trim()) {
      return NextResponse.json({ error: "Missing url." }, { status: 400 });
    }

    // Get effective settings (user settings take precedence)
    const settings = getEffectiveSettings(userSettings);
    const fallbackCount = getFallbackCountFromCookie(request);
    let nextFallbackCount = fallbackCount;
    const voiceGender: VoiceGender = settings.narratorPersona === "brandon" ? "male" : "female";
    const personaName = settings.narratorPersona === "brandon" ? "Brandon" : "Brenda";

    if (!settings.ollamaBaseUrl && !settings.llmApiKey) {
      throw new Error("Set either an LLM endpoint URL or an LLM API key in Settings.");
    }
    if (!settings.llmApiKey && isServerlessRuntime() && isLocalhostUrl(settings.ollamaBaseUrl)) {
      throw new Error("Localhost/127.0.0.1 endpoint is not reachable from production. Set a public LLM endpoint in Settings.");
    }

    const product = await scrapeAmazonProduct(url);
    const mode = settings.roastMode || requestedMode;
    const { roast, verdict } = await generateRoast(
      product,
      mode,
      {
        model: settings.ollamaModel,
        baseUrl: settings.ollamaBaseUrl,
        apiKey: settings.llmApiKey,
        apiBaseUrl: settings.llmApiBaseUrl,
        personaName,
        roastLanguage: settings.roastLanguage,
      }
    );

    const skip = skipTts();
    let audioBase64 = "";
    /** Character timings when ElevenLabs returns them */
    let alignment: ApiResponse["alignment"];
    /** Which provider produced audio */
    let ttsProvider: NonNullable<ApiResponse["ttsProvider"]> | undefined;

    if (!skip) {
      if (!settings.elevenLabsApiKey && !settings.noizApiKey) {
        throw new Error("No TTS API key configured in Settings. Add ElevenLabs or Noiz key in the dialog.");
      }

      const noizVoiceId =
        voiceGender === "male"
          ? (settings.noizVoiceIdMale || settings.noizVoiceId)
          : (settings.noizVoiceIdFemale || settings.noizVoiceId);

      if (shouldUseElevenLabsTts(settings.elevenLabsApiKey)) {
        try {
          // Use only the selected gender voice ID from dialog settings.
          const voiceId = voiceGender === "male" 
            ? settings.elevenLabsVoiceIdMale
            : settings.elevenLabsVoiceIdFemale;
          
          if (!voiceId) {
            throw new Error(`No ElevenLabs ${voiceGender} voice ID configured in Settings`);
          }
          
          const { audio, alignment: al } = await synthesizeSpeechElevenLabs(roast, voiceId, {
            apiKey: settings.elevenLabsApiKey,
            modelId: settings.elevenLabsTtsModelId,
          });
          audioBase64 = audio.toString("base64");
          alignment = al ?? null;
          ttsProvider = "elevenlabs";
          console.log("[roast:tts] provider=elevenlabs", {
            voiceGender,
            voiceIdSource:
              voiceGender === "male"
                ? (settings.elevenLabsVoiceIdMale ? "settings" : "missing")
                : (settings.elevenLabsVoiceIdFemale ? "settings" : "missing"),
            apiKeySource: settings.elevenLabsApiKey ? "settings" : "missing",
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "ElevenLabs TTS failed.";
          console.error("[tts] elevenlabs fallback to noiz:", msg);

          try {
            if (fallbackCount >= FALLBACK_LIMIT_MAX) {
              throw new Error(`Fallback voice limit reached (${FALLBACK_LIMIT_MAX} uses).`);
            }
            const audioBuffer = await synthesizeRoastSpeechNoiz(roast, settings.noizApiKey, noizVoiceId, {
              outputFormat: settings.noizOutputFormat,
              speed: settings.noizSpeed,
              qualityPreset: settings.noizQualityPreset,
            });
            audioBase64 = audioBuffer.toString("base64");
            alignment = null;
            ttsProvider = "noiz";
            nextFallbackCount = fallbackCount + 1;
            console.log("[roast:tts] provider=noiz(fallback)", {
              voiceGender,
              noizVoiceIdSource:
                voiceGender === "male"
                  ? (settings.noizVoiceIdMale ? "settings male" : settings.noizVoiceId ? "settings legacy fallback" : "missing")
                  : (settings.noizVoiceIdFemale ? "settings female" : settings.noizVoiceId ? "settings legacy fallback" : "missing"),
              noizApiKeySource: settings.noizApiKey ? "settings" : "missing",
            });
          } catch (fallbackErr) {
            const fb = fallbackErr instanceof Error ? fallbackErr.message : "Noiz TTS failed.";
            throw new Error(`Voice generation failed (${msg}). Fallback Noiz failed: ${fb}`);
          }
        }
      } else {
        if (fallbackCount >= FALLBACK_LIMIT_MAX) {
          throw new Error(`Fallback voice limit reached (${FALLBACK_LIMIT_MAX} uses).`);
        }
        const audioBuffer = await synthesizeRoastSpeechNoiz(roast, settings.noizApiKey, noizVoiceId, {
          outputFormat: settings.noizOutputFormat,
          speed: settings.noizSpeed,
          qualityPreset: settings.noizQualityPreset,
        });
        audioBase64 = audioBuffer.toString("base64");
        alignment = null;
        ttsProvider = "noiz";
        nextFallbackCount = fallbackCount + 1;
        console.log("[roast:tts] provider=noiz", {
          voiceGender,
          noizVoiceIdSource:
            voiceGender === "male"
              ? (settings.noizVoiceIdMale ? "settings male" : settings.noizVoiceId ? "settings legacy fallback" : "missing")
              : (settings.noizVoiceIdFemale ? "settings female" : settings.noizVoiceId ? "settings legacy fallback" : "missing"),
          noizApiKeySource: settings.noizApiKey ? "settings" : "missing",
        });
      }
    }

    console.log("[roast:llm]", {
      ollamaModel: settings.ollamaModel,
      ollamaModelSource: settings.__source.ollamaModel,
      llmEndpointConfigured: Boolean(settings.ollamaBaseUrl),
      llmApiKeyConfigured: Boolean(settings.llmApiKey),
      roastLanguage: settings.roastLanguage,
      persona: personaName,
      voiceGender,
    });

    const payload: ApiResponse = {
      product,
      roast,
      verdict,
      audio: audioBase64,
      alignment: alignment ?? null,
      ...(ttsProvider ? { ttsProvider } : {}),
      ttsSkipped: skip,
    };

    const response = NextResponse.json(payload);
    if (nextFallbackCount !== fallbackCount) {
      response.headers.append(
        "Set-Cookie",
        `${FALLBACK_LIMIT_COOKIE}=${nextFallbackCount}; Path=/; Max-Age=2592000; SameSite=Lax`
      );
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    const status = message.includes("Invalid") || message.includes("Only Amazon") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
