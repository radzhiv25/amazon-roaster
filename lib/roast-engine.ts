import "server-only";
import type { ProductData, RoastMode, RoastResponse } from "@/types";

/** Hard cap on `roast` length (prompt + clamp). Keep in sync with prompt text. */
export const ROAST_MAX_CHARS = 800;
type RoastLanguage = "english" | "hindi" | "hinglish";

function buildSystemPrompt(personaName: string): string {
  return `You are ${personaName}, a sarcastic Amazon product critic who roasts listings like a disappointed influencer on live video. You are sharp, theatrical, and funny-never cruel about protected classes, never instructive about self-harm or illegal acts, and you keep it about the product and the absurdity of the listing.

You MUST respond with a single JSON object and nothing else-no markdown fences, no preamble. The JSON must match this shape exactly:
{"roast":"string - tight spoken monologue, MUST be ${ROAST_MAX_CHARS} characters or fewer (count every character including spaces). Pack your best lines; no filler; end on a strong beat within the budget.","verdict":"string - one punchy closing line (keep brief)"}`;
}

function buildUserPrompt(
  product: ProductData,
  mode: RoastMode,
  personaName: string,
  roastLanguage: RoastLanguage
): string {
  const block = [
    "SCRAPED_PRODUCT:",
    `title: ${product.title || "(missing)"}`,
    `brand: ${product.brand || "(missing)"}`,
    `price: ${product.price || "(missing)"}`,
    `rating: ${product.rating || "(missing)"}`,
    `review_count: ${product.reviewCount || "(missing)"}`,
    `bullets:`,
    ...(product.bullets.length ? product.bullets.map((b) => `- ${b}`) : ["- (none)"]),
    `top_reviews:`,
    ...(product.reviews.length ? product.reviews.map((r, i) => `${i + 1}. ${r}`) : ["(none)"]),
    `image_url: ${product.imageUrl || "(missing)"}`,
  ].join("\n");

  const modeLine =
    mode === "harder"
      ? "MODE: harder - turn the heat up; still playful, no slurs, no harassment of real people."
      : mode === "reRoast"
        ? "MODE: re-roast - completely fresh angles and jokes; do not repeat phrasing or beats from a hypothetical prior roast."
        : `MODE: standard - classic ${personaName} energy.`;

  const languageLine =
    roastLanguage === "hindi"
      ? "LANGUAGE: Hindi (Devanagari). Keep all output fields in Hindi naturally."
      : roastLanguage === "hinglish"
        ? "LANGUAGE: Hinglish (natural Hindi + English mix, commonly spoken style)."
        : "LANGUAGE: English.";

  return `${modeLine}\n${languageLine}\n\nCONSTRAINT: The JSON "roast" string must be at most ${ROAST_MAX_CHARS} characters after trimming (shorter is fine; prioritize punch over padding).\n\n${block}`;
}

/** If the model overshoots, trim to `max` with a clean break when possible. */
function clampRoastLength(roast: string, max: number): string {
  const t = roast.trim();
  if (t.length <= max) return t;

  const ellipsis = "\u2026";
  const head = t.slice(0, max);
  const minScan = Math.floor(max * 0.45);

  for (let i = head.length - 1; i >= minScan; i--) {
    const c = head[i];
    if (c === "." || c === "!" || c === "?") {
      const out = head.slice(0, i + 1).trimEnd();
      if (out.length > 0 && out.length <= max) return out;
    }
  }

  const cut = max - ellipsis.length;
  let slice = t.slice(0, Math.min(cut, t.length)).trimEnd();
  const lastSpace = slice.lastIndexOf(" ");
  const minWordBreak = Math.floor(cut * 0.55);
  if (lastSpace >= minWordBreak) {
    slice = slice.slice(0, lastSpace).trimEnd();
  }
  if (slice.length === 0) {
    return t.slice(0, max);
  }
  return slice + ellipsis;
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();

  // Try to extract from markdown code fence
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    return fence[1].trim();
  }

  // Try to find JSON object
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  // Try to find JSON array
  const arrStart = trimmed.indexOf("[");
  const arrEnd = trimmed.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd > arrStart) {
    return trimmed.slice(arrStart, arrEnd + 1);
  }

  return trimmed;
}

function parseRoastJson(text: string): RoastResponse {
  const slice = extractJsonObject(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(slice);
  } catch {
    console.error("[parseRoastJson] Failed to parse JSON:", slice.slice(0, 500));
    throw new Error("LLM returned invalid JSON for the roast.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("LLM roast payload was not an object.");
  }
  const obj = parsed as Record<string, unknown>;
  const roastRaw = typeof obj.roast === "string" ? obj.roast : "";
  const roastTrimmed = roastRaw.trim();
  const verdict = typeof obj.verdict === "string" ? obj.verdict : "";
  if (!roastTrimmed) {
    throw new Error("LLM returned an empty roast.");
  }
  const roast = clampRoastLength(roastTrimmed, ROAST_MAX_CHARS);
  return { roast, verdict };
}

export async function generateRoast(
  product: ProductData,
  mode: RoastMode,
  config: {
    model: string;
    baseUrl?: string;
    apiKey?: string;
    apiBaseUrl?: string;
    personaName?: string;
    roastLanguage?: RoastLanguage;
  }
): Promise<RoastResponse> {
  const { model, baseUrl, apiKey, apiBaseUrl, personaName = "Brenda", roastLanguage = "english" } = config;
  const messages = [
    { role: "system", content: buildSystemPrompt(personaName) },
    { role: "user", content: buildUserPrompt(product, mode, personaName, roastLanguage) },
  ] as const;

  let text = "";

  if (apiKey?.trim()) {
    const endpoint = (apiBaseUrl?.trim() || "https://openrouter.ai/api/v1").replace(/\/$/, "");
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.9,
        max_tokens: 900,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`LLM API request failed (${response.status}): ${detail.slice(0, 500)}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string } | string;
    };
    text = payload.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) {
      const errorMessage =
        typeof payload.error === "string" ? payload.error : payload.error?.message;
      throw new Error(errorMessage || "LLM API returned no text content.");
    }
  } else {
    const endpoint = baseUrl?.trim();
    if (!endpoint) {
      throw new Error("Missing LLM endpoint URL.");
    }
    const response = await fetch(`${endpoint.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages,
        options: { num_predict: 900, temperature: 0.9 },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Ollama request failed (${response.status}): ${detail.slice(0, 500)}`);
    }

    const payload = (await response.json()) as {
      message?: { content?: string };
      response?: string;
      error?: string;
    };
    text = payload.message?.content ?? payload.response ?? "";
    if (!text.trim()) {
      throw new Error(payload.error || "Ollama returned no text content.");
    }
  }

  if (!text.trim()) {
    throw new Error("LLM returned no text content.");
  }
  return parseRoastJson(text);
}
