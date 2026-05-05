"use client";

import type { MutableRefObject } from "react";
import { memo, useEffect, useMemo, useState } from "react";

import {
  AudioPlayerDuration,
  AudioPlayerProgress,
  AudioPlayerProvider,
  AudioPlayerSpeed,
  AudioPlayerButton,
  useAudioPlayer,
  useAudioPlayerTime,
} from "@/components/ui/audio-player";
import { Matrix } from "@/components/ui/matrix";
import {
  approximateAlignmentFromPlainText,
  defaultComposeAlignment,
  sliceTranscriptByPlayback,
} from "@/lib/transcript-alignment";
import type { RoastAlignment } from "@/types";

import { cn } from "@/lib/utils";
import { useAudioAnalyserBands } from "@/hooks/use-audio-analyser-bands";

export function RoastAudioExperience({
  roastText,
  audioBlobUrl,
  alignmentProp,
}: {
  roastText: string;
  audioBlobUrl: string | null;
  alignmentProp?: RoastAlignment | null;
}) {
  if (!audioBlobUrl) return null;

  return (
    <AudioPlayerProvider>
      <RoastPlaybackInner alignmentProp={alignmentProp ?? null} audioBlobUrl={audioBlobUrl} roastText={roastText} />
    </AudioPlayerProvider>
  );
}

const RoastPlaybackInner = memo(function RoastPlaybackInner({
  roastText,
  audioBlobUrl,
  alignmentProp,
}: {
  roastText: string;
  audioBlobUrl: string;
  alignmentProp: RoastAlignment | null;
}) {
  const elapsed = useAudioPlayerTime();

  const player = useAudioPlayer();
  const roastItem = useMemo(
    () => ({ id: "roast-single" as const, src: audioBlobUrl }),
    [audioBlobUrl]
  );

  useEffect(() => {
    void player.setActiveItem(roastItem);
  }, [player, roastItem]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:items-stretch">
        <div className="w-max flex shrink-0 items-center justify-center overflow-hidden rounded-none border border-border/70 bg-card p-2">
          <RoastVuMatrix
            audioRef={player.ref as MutableRefObject<HTMLAudioElement | null>}
            cols={25}
            rows={25}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <AudioPlayerButton item={roastItem} variant="default" size="icon" className="size-10 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <AudioPlayerProgress className="w-full data-[orientation=horizontal]:grow" />
              <div className="text-muted-foreground flex items-center gap-2 font-mono text-xs tabular-nums">
                <span>
                  <ClockFromSeconds fraction={elapsed} />
                </span>
                <span>/</span>
                <span className="text-muted-foreground">
                  <AudioPlayerDuration />
                </span>
              </div>
            </div>
            <AudioPlayerSpeed variant="outline" size="icon" className="size-10 shrink-0" />
          </div>

          <p className="text-muted-foreground text-xs tracking-wide uppercase">Live transcript</p>

          <SyncedRoastWords alignmentProp={alignmentProp} roastFallback={roastText} />
        </div>
      </div>
    </div>
  );
});

function ClockFromSeconds({ fraction }: { fraction: number }) {
  const mins = Math.floor(fraction / 60);
  const secs = Math.floor(fraction % 60)
    .toString()
    .padStart(2, "0");
  return <>{`${mins}:${secs}`}</>;
}

const RoastVuMatrix = memo(function RoastVuMatrix({
  audioRef,
  rows,
  cols,
}: {
  audioRef: MutableRefObject<HTMLAudioElement | null>;
  rows: number;
  cols: number;
}) {
  const rawBands = useAudioAnalyserBands(audioRef, cols);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const step = (time: number) => {
      if (last === 0) last = time;
      const delta = time - last;
      last = time;
      setPhase((prev) => prev + delta * 0.006);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const bands = useMemo(() => {
    const hasSignal = rawBands.some((value) => value > 0.03);
    if (hasSignal) {
      const energy = rawBands.reduce((acc, v) => acc + v, 0) / Math.max(1, rawBands.length);
      const emphasized = rawBands.map((value, idx) => {
        const tilt = 1 - idx / Math.max(1, cols - 1);
        const ambience = Math.sin(phase * 0.9 + idx * 0.35) * 0.03;
        const boosted = value * 0.88 + energy * (0.42 + tilt * 0.18) + ambience;
        return Math.max(0.02, Math.min(1, boosted));
      });
      return emphasized.map((value, idx) => {
        const left = emphasized[Math.max(0, idx - 1)] ?? value;
        const right = emphasized[Math.min(emphasized.length - 1, idx + 1)] ?? value;
        const smoothed = value * 0.62 + left * 0.19 + right * 0.19;
        const crossBleed = energy * (0.2 + 0.1 * Math.sin(phase * 0.5 + idx * 0.2));
        return Math.max(0.02, Math.min(1, smoothed + crossBleed));
      });
    }

    // Keep a subtle animated baseline so the matrix feels interactive before playback.
    return rawBands.map((_, idx) => {
      const waveA = Math.sin(phase + idx * 0.42) * 0.06;
      const waveB = Math.sin(phase * 0.6 - idx * 0.23) * 0.04;
      return Math.max(0.02, Math.min(0.2, 0.08 + waveA + waveB));
    });
  }, [rawBands, phase, cols]);

  return (
    <Matrix
      mode="vu"
      rows={rows}
      cols={cols}
      levels={bands}
      size={4}
      gap={3}
      className="shrink-0"
      autoplay={false}
      ariaLabel="Playback level meter"
      palette={{
        on: "var(--primary)",
        off: "var(--muted-foreground)",
      }}
    />
  );
});

/** Word highlights stay in sync with `AudioPlayerTime` ticks */

function SyncedRoastWords({
  alignmentProp,
  roastFallback,
}: {
  alignmentProp: RoastAlignment | null;
  roastFallback: string;
}) {
  const currentTime = useAudioPlayerTime();
  const duration = useAudioPlayer().duration;
  const dur = duration !== undefined && Number.isFinite(duration) ? duration : 0;
  const transcriptTime = Math.round(currentTime * 12) / 12;

  const segments = useMemo(() => {
    const aligned =
      alignmentProp ??
      (dur > 0
        ? approximateAlignmentFromPlainText(roastFallback, dur)
        : approximateAlignmentFromPlainText(roastFallback, 1));
    return defaultComposeAlignment(aligned);
  }, [alignmentProp, roastFallback, dur]);

  const segmentsWithStatus = useMemo(() => {
    if (segments.length === 0) {
      return [] as Array<{ segment: (typeof segments)[number]; status: "spoken" | "unspoken" | "current" }>;
    }

    if (dur > 0 && transcriptTime >= dur - 0.01) {
      return segments.map((segment) => ({
        segment,
        status: "spoken" as const,
      }));
    }

    const { spokenSegments, currentWord, unspokenSegments } = sliceTranscriptByPlayback(
      segments,
      transcriptTime,
      dur
    );

    type Status = "spoken" | "unspoken" | "current";
    const entries: Array<{ segment: (typeof segments)[number]; status: Status }> = [];
    const append = (list: typeof spokenSegments | typeof unspokenSegments, status: Exclude<Status, "current">) => {
      for (const segment of list) entries.push({ segment, status });
    };

    append(spokenSegments, "spoken");
    if (currentWord) entries.push({ segment: currentWord, status: "current" });
    append(unspokenSegments, "unspoken");
    return entries;
  }, [segments, transcriptTime, dur]);

  return (
    <div className="text-md leading-relaxed tracking-tight text-foreground">
      {segmentsWithStatus.map(({ segment, status }) => {
        const wordStyle =
          status === "spoken"
            ? "text-foreground"
            : status === "current"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-foreground/70";

        const gapStyle = status === "spoken" ? "text-foreground/90" : "text-foreground/60";

        if (segment.kind === "gap") {
          return (
            <span key={`gap-${segment.segmentIndex}`} className={cn("transition-colors", gapStyle)}>
              {segment.text}
            </span>
          );
        }

        return (
          <span key={`word-${segment.segmentIndex}`} className={cn("rounded-none px-0.5 transition-colors", wordStyle)}>
            {segment.text}
          </span>
        );
      })}
    </div>
  );
}
