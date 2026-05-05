import type { RoastAlignment } from "@/types";

export type TranscriptSegmentWord = {
  kind: "word";
  segmentIndex: number;
  text: string;
  startTime: number;
  endTime: number;
};

export type TranscriptSegmentGap = {
  kind: "gap";
  segmentIndex: number;
  text: string;
  startTime: number;
  endTime: number;
};

export type TranscriptSegment = TranscriptSegmentWord | TranscriptSegmentGap;

export type SegmentComposer = (alignment: RoastAlignment) => TranscriptSegment[];

/** Group character-level alignment into word + whitespace gap segments with timings. */
export function defaultComposeAlignment(alignment: RoastAlignment): TranscriptSegment[] {
  const { characters, characterStartTimesSeconds: starts, characterEndTimesSeconds: ends } = alignment;
  if (!characters?.length || !starts?.length || !ends?.length) {
    return [];
  }
  const n = characters.length;
  const segments: TranscriptSegment[] = [];
  let i = 0;
  let segmentIndex = 0;

  while (i < n) {
    const ch = characters[i] ?? "";
    if (/\s/.test(ch)) {
      let gap = "";
      let g0 = Number.POSITIVE_INFINITY;
      let g1 = 0;
      while (i < n && /\s/.test(characters[i] ?? "")) {
        gap += characters[i];
        g0 = Math.min(g0, starts[i] ?? g0);
        g1 = Math.max(g1, ends[i] ?? g1);
        i++;
      }
      segments.push({
        kind: "gap",
        segmentIndex,
        text: gap,
        startTime: Number.isFinite(g0) ? g0 : 0,
        endTime: g1,
      });
      segmentIndex++;
      continue;
    }

    let word = "";
    let t0 = Number.POSITIVE_INFINITY;
    let t1 = 0;
    while (i < n && !/\s/.test(characters[i] ?? "")) {
      word += characters[i];
      t0 = Math.min(t0, starts[i] ?? t0);
      t1 = Math.max(t1, ends[i] ?? t1);
      i++;
    }
    if (word.length > 0) {
      segments.push({
        kind: "word",
        segmentIndex,
        text: word,
        startTime: Number.isFinite(t0) ? t0 : 0,
        endTime: t1,
      });
      segmentIndex++;
    }
  }

  return segments;
}

/**
 * Mirrors `TranscriptViewerWords` partitioning (words vs gaps preserved in-order per bucket).
 */
/** Even spacing when ElevenLabs alignment is unavailable (e.g. Noiz TTS). */
export function approximateAlignmentFromPlainText(text: string, durationSec: number): RoastAlignment {
  const chars = [...text.trim()];
  const n = chars.length || 1;
  const safeDur = durationSec > 0 ? durationSec : 1;
  return {
    characters: chars.map((ch) => (ch === " " ? " " : ch)),
    characterStartTimesSeconds: chars.map((_, i) => (safeDur * i) / n),
    characterEndTimesSeconds: chars.map((_, i) => (safeDur * (i + 1)) / n),
  };
}

export function sliceTranscriptByPlayback(
  segments: TranscriptSegment[],
  currentTime: number,
  duration: number
): {
  spokenSegments: TranscriptSegment[];
  currentWord: TranscriptSegmentWord | null;
  unspokenSegments: TranscriptSegment[];
} {
  const nearEnd = duration > 0 && currentTime >= duration - 0.01;
  if (nearEnd || segments.length === 0) {
    return {
      spokenSegments: segments,
      currentWord: null,
      unspokenSegments: [],
    };
  }

  const rebuiltSpoken: TranscriptSegment[] = [];
  let rebuiltCurrent: TranscriptSegmentWord | null = null;
  const rebuiltUnspoken: TranscriptSegment[] = [];

  for (const segment of segments) {
    if (segment.kind === "gap") {
      if (currentTime < segment.startTime) {
        rebuiltUnspoken.push(segment);
      } else {
        rebuiltSpoken.push(segment);
      }
      continue;
    }

    const w = segment;
    if (currentTime >= w.endTime) {
      rebuiltSpoken.push(w);
    } else if (currentTime >= w.startTime && currentTime < w.endTime) {
      rebuiltCurrent = w;
    } else {
      rebuiltUnspoken.push(w);
    }
  }

  return {
    spokenSegments: rebuiltSpoken,
    currentWord: rebuiltCurrent,
    unspokenSegments: rebuiltUnspoken,
  };
}
