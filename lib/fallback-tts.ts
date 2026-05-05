import "server-only";

const NOIZ_TTS_URL = "https://noiz.ai/v1/text-to-speech";
/** Noiz accepts up to 5000 characters per request. */
const MAX_TEXT_CHARS = 5000;

function pickString(obj: unknown, paths: string[][]): string | null {
  if (!obj || typeof obj !== "object") return null;
  for (const path of paths) {
    let cur: unknown = obj;
    for (const key of path) {
      if (!cur || typeof cur !== "object" || !(key in cur)) {
        cur = undefined;
        break;
      }
      cur = (cur as Record<string, unknown>)[key];
    }
    if (typeof cur === "string" && cur.trim()) {
      return cur.trim();
    }
  }
  return null;
}

export async function synthesizeRoastSpeech(
  text: string,
  apiKey?: string,
  voiceId?: string,
  opts?: {
    outputFormat?: string;
    speed?: string;
    qualityPreset?: string;
  }
): Promise<Buffer> {
  const effectiveApiKey = apiKey?.trim();
  const effectiveVoiceId = voiceId?.trim();

  if (!effectiveApiKey) {
    throw new Error("Missing Noiz API key in settings.");
  }
  if (!effectiveVoiceId) {
    throw new Error(
      "Missing Noiz voice ID in settings. Your Noiz workspace requires a voice_id (or uploaded file) for TTS."
    );
  }

  const trimmed = text.trim();
  const bodyText = trimmed.length <= MAX_TEXT_CHARS ? trimmed : trimmed.slice(0, MAX_TEXT_CHARS);

  const form = new FormData();
  form.append("text", bodyText);
  form.append("voice_id", effectiveVoiceId);
  form.append("output_format", opts?.outputFormat?.trim() || "mp3");
  form.append("speed", opts?.speed?.trim() || "1");
  form.append("quality_preset", opts?.qualityPreset?.trim() || "3");

  const response = await fetch(NOIZ_TTS_URL, {
    method: "POST",
    headers: {
      Authorization: effectiveApiKey,
    },
    body: form,
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Noiz request failed (${response.status}): ${errBody.slice(0, 500)}`);
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) {
    const json = (await response.json().catch(() => null)) as unknown;
    const base64Audio = pickString(json, [
      ["audio"],
      ["audio_base64"],
      ["data", "audio"],
      ["data", "audio_base64"],
    ]);
    if (base64Audio) {
      try {
        return Buffer.from(base64Audio, "base64");
      } catch {
        throw new Error("Noiz returned invalid base64 audio.");
      }
    }

    const audioUrl = pickString(json, [
      ["audio_url"],
      ["url"],
      ["data", "audio_url"],
      ["data", "url"],
    ]);
    if (audioUrl) {
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Noiz audio URL failed (${audioResponse.status}).`);
      }
      return Buffer.from(await audioResponse.arrayBuffer());
    }

    const message = pickString(json, [["message"], ["error"], ["detail"], ["data", "message"]]);
    throw new Error(`Noiz returned JSON instead of audio${message ? `: ${message}` : "."}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  if (audioBuffer.length === 0) {
    throw new Error("Noiz returned an empty audio response.");
  }
  return audioBuffer;
}
