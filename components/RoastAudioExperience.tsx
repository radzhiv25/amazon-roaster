"use client";

import type { MutableRefObject } from "react";
import { memo, useEffect, useMemo } from "react";

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-900/95 p-4 dark:border-zinc-700">
          <RoastVuMatrix audioRef={player.ref as MutableRefObject<HTMLAudioElement | null>} cols={26} rows={11} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <AudioPlayerButton item={roastItem} variant="default" size="icon" className="size-11 shrink-0" />
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
            <AudioPlayerSpeed variant="outline" size="icon" />
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
  // Temporarily disable analyser to test if it's causing the issue
  // const bands = useAudioAnalyserBands(audioRef, cols);
  const bands = Array.from({ length: cols }, () => Math.random() * 0.5 + 0.2);
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
        on: "text-amber-400",
        off: "text-zinc-800 dark:text-zinc-900",
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

  const segmentsWithStatus = useMemo(() => {
    const aligned =
      alignmentProp ??
      (dur > 0 ? approximateAlignmentFromPlainText(roastFallback, dur) : approximateAlignmentFromPlainText(roastFallback, 1));
    const segments = defaultComposeAlignment(aligned);

    if (segments.length === 0) {
      return [] as Array<{ segment: (typeof segments)[number]; status: "spoken" | "unspoken" | "current" }>;
    }

    if (dur > 0 && currentTime >= dur - 0.01) {
      return segments.map((segment) => ({
        segment,
        status: "spoken" as const,
      }));
    }

    const { spokenSegments, currentWord, unspokenSegments } = sliceTranscriptByPlayback(segments, currentTime, dur);

    type Status = "spoken" | "unspoken" | "current";
    const entries: Array<{ segment: (typeof segments)[number]; status: Status }> = [];
    const append = (list: typeof spokenSegments | typeof unspokenSegments, status: Exclude<Status, "current">) => {
      for (const segment of list) entries.push({ segment, status });
    };

    append(spokenSegments, "spoken");
    if (currentWord) entries.push({ segment: currentWord, status: "current" });
    append(unspokenSegments, "unspoken");
    return entries;
  }, [alignmentProp, roastFallback, currentTime, dur]);

  return (
    <div className="text-xl leading-relaxed tracking-tight text-zinc-800 dark:text-zinc-200">
      {segmentsWithStatus.map(({ segment, status }) => {
        const wordStyle =
          status === "spoken"
            ? "text-zinc-800 dark:text-zinc-100"
            : status === "current"
              ? "bg-amber-500 text-white shadow-sm dark:bg-amber-500 dark:text-zinc-950"
              : "text-zinc-400 dark:text-zinc-500";

        const gapStyle = status === "spoken" ? wordStyle : "text-muted-foreground";

        if (segment.kind === "gap") {
          return (
            <span key={`gap-${segment.segmentIndex}`} className={cn("transition-colors", gapStyle)}>
              {segment.text}
            </span>
          );
        }

        return (
          <span key={`word-${segment.segmentIndex}`} className={cn("rounded-sm px-0.5 transition-colors", wordStyle)}>
            {segment.text}
          </span>
        );
      })}
    </div>
  );
}
