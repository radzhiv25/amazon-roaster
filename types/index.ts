/** ElevenLabs-style voice persona for synth (mapped to voice IDs via env). */
export type VoiceGender = "female" | "male";

export type RoastAlignment = {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
};

export type BadgeType = "red" | "amber" | "green";

export interface ProductData {
  title: string;
  brand: string;
  price: string;
  rating: string;
  reviewCount: string;
  bullets: string[];
  reviews: string[];
  imageUrl: string;
}

export interface Badge {
  label: string;
  type: BadgeType;
}

export interface RoastResponse {
  roast: string;
  verdict: string;
  badges: Badge[];
}

export interface ApiResponse {
  product: ProductData;
  roast: string;
  verdict: string;
  badges: Badge[];
  /** Base64-encoded MP3, or empty string when TTS is skipped. */
  audio: string;
  /** Character-level timings when synthesized with ElevenLabs `convertWithTimestamps`. */
  alignment?: RoastAlignment | null;
  /** Which synth path produced `audio`. */
  ttsProvider?: "elevenlabs" | "noiz";
  /** True when `SKIP_TTS` is set — no external TTS call was made. */
  ttsSkipped?: boolean;
}

export type RoastMode = "standard" | "harder" | "reRoast";
