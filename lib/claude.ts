import "server-only";
import type { ProductData, RoastMode, RoastResponse } from "@/types";

const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "minimax-m2.5:cloud";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";

/** Hard cap on `roast` length (prompt + clamp). Keep in sync with prompt text. */
export const ROAST_MAX_CHARS = 800;

const BRENDA_SYSTEM = `You are Brenda, a sarcastic Amazon product critic who roasts listings like a disappointed influencer on live video. You are sharp, theatrical, and funny—never cruel about protected classes, never instructive about self-harm or illegal acts, and you keep it about the product and the absurdity of the listing.

You MUST respond with a single JSON object and nothing else—no markdown fences, no preamble. The JSON must match this shape exactly:
{"roast":"string — tight spoken monologue, MUST be ${ROAST_MAX_CHARS} characters or fewer (count every character including spaces). Pack your best lines; no filler; end on a strong beat within the budget.","verdict":"string — one punchy closing line (keep brief)","badges":[{"label":"string","type":"red"|"amber"|"green"}]}

Use 3–6 badges. "red" is a savage ding, "amber" is a side-eye / mixed bag, "green" is a reluctant compliment or "only redeeming thing" joke.`;

function buildUserPrompt(product: ProductData, mode: RoastMode): string {
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
      ? "MODE: harder — turn the heat up; still playful, no slurs, no harassment of real people."
      : mode === "reRoast"
        ? "MODE: re-roast — completely fresh angles and jokes; do not repeat phrasing or beats from a hypothetical prior roast."
        : "MODE: standard — classic Brenda energy.";

  return `${modeLine}\n\nCONSTRAINT: The JSON "roast" string must be at most ${ROAST_MAX_CHARS} characters after trimming (shorter is fine; prioritize punch over padding).\n\n${block}`;
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
  } catch (e) {
    // Log the problematic text for debugging
    console.error("[parseRoastJson] Failed to parse JSON:", slice.slice(0, 500));
    throw new Error(`LLM returned invalid JSON for the roast.`);
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("LLM roast payload was not an object.");
  }
  const obj = parsed as Record<string, unknown>;
  const roastRaw = typeof obj.roast === "string" ? obj.roast : "";
  const roastTrimmed = roastRaw.trim();
  const verdict = typeof obj.verdict === "string" ? obj.verdict : "";
  const badgesRaw = obj.badges;
  const badges: RoastResponse["badges"] = [];
  if (Array.isArray(badgesRaw)) {
    for (const b of badgesRaw) {
      if (!b || typeof b !== "object") continue;
      const br = b as Record<string, unknown>;
      const label = typeof br.label === "string" ? br.label : "";
      const type = br.type === "red" || br.type === "amber" || br.type === "green" ? br.type : "amber";
      if (label) badges.push({ label, type });
    }
  }
  if (!roastTrimmed) {
    throw new Error("LLM returned an empty roast.");
  }
  const roast = clampRoastLength(roastTrimmed, ROAST_MAX_CHARS);
  return { roast, verdict, badges };
}

export async function generateRoast(product: ProductData, mode: RoastMode): Promise<RoastResponse> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      messages: [
        { role: "system", content: BRENDA_SYSTEM },
        { role: "user", content: buildUserPrompt(product, mode) },
      ],
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
  const text = payload.message?.content ?? payload.response ?? "";
  if (!text.trim()) {
    throw new Error(payload.error || "Ollama returned no text content.");
  }
  // Log raw response for debugging
  console.log("[generateRoast] Raw LLM response:", text.slice(0, 500));
  return parseRoastJson(text);
}
