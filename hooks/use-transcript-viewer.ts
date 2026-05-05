"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RoastAlignment } from "@/types";

import {
  defaultComposeAlignment,
  sliceTranscriptByPlayback,
  type SegmentComposer,
  type TranscriptSegment,
} from "@/lib/transcript-alignment";

export type TranscriptWord = Extract<TranscriptSegment, { kind: "word" }>;
export type { TranscriptSegment, SegmentComposer };

export interface UseTranscriptViewerOptions {
  alignment: RoastAlignment;
  hideAudioTags?: boolean;
  segmentComposer?: SegmentComposer;
  onPlay?: () => void;
  onPause?: () => void;
  onTimeUpdate?: (timeSeconds: number) => void;
  onEnded?: () => void;
  onDurationChange?: (durationSeconds: number) => void;
}

export interface UseTranscriptViewerResult {
  alignment: RoastAlignment;
  segments: TranscriptSegment[];
  spokenSegments: TranscriptSegment[];
  unspokenSegments: TranscriptSegment[];
  currentWord: TranscriptWord | null;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  hideAudioTags: boolean;
  play: () => Promise<void> | void;
  pause: () => void;
  seekToTime: (timeSeconds: number) => void;
  startScrubbing: () => void;
  endScrubbing: () => void;
  audioRef: RefObject<HTMLAudioElement | null>;
}

export function useTranscriptViewer({
  alignment,
  hideAudioTags = false,
  segmentComposer = defaultComposeAlignment,
  onPlay,
  onPause,
  onTimeUpdate,
  onEnded,
  onDurationChange,
}: UseTranscriptViewerOptions): UseTranscriptViewerResult {
  const audioRef = useRef<HTMLAudioElement>(null);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const segments = useMemo(() => segmentComposer(alignment), [alignment, segmentComposer]);

  const { spokenSegments, unspokenSegments, currentWord } = useMemo(
    () => sliceTranscriptByPlayback(segments, currentTime, duration),
    [segments, currentTime, duration]
  );

  const wasPlayingDuringScrub = useRef(false);

  const startScrubbing = useCallback(() => {
    const el = audioRef.current;
    wasPlayingDuringScrub.current = el ? !el.paused : false;
    void el?.pause();
  }, []);

  const endScrubbing = useCallback(() => {
    if (!wasPlayingDuringScrub.current) return;
    const el = audioRef.current;
    if (!el) return;
    void el.play();
    wasPlayingDuringScrub.current = false;
  }, []);

  const seekToTime = useCallback((timeSeconds: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, timeSeconds);
    setCurrentTime(el.currentTime);
  }, []);

  const play = useCallback(async () => {
    const el = audioRef.current;
    if (!el) return;
    await el.play();
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return undefined;

    const bumpFromElement = () => {
      const dur = Number.isFinite(el.duration) ? el.duration : 0;
      setDuration(dur);
      setCurrentTime(el.currentTime || 0);
      onDurationChange?.(dur);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(el.currentTime);
      onTimeUpdate?.(el.currentTime);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      onPlay?.();
    };

    const handlePause = () => {
      setIsPlaying(false);
      onPause?.();
    };

    const handleEnded = () => {
      setIsPlaying(false);
      const endT = Number.isFinite(el.duration) ? el.duration : el.currentTime;
      setCurrentTime(endT);
      onEnded?.();
    };

    el.addEventListener("timeupdate", handleTimeUpdate);
    el.addEventListener("durationchange", bumpFromElement);
    el.addEventListener("loadedmetadata", bumpFromElement);
    el.addEventListener("play", handlePlay);
    el.addEventListener("pause", handlePause);
    el.addEventListener("ended", handleEnded);

    bumpFromElement();

    return () => {
      el.removeEventListener("timeupdate", handleTimeUpdate);
      el.removeEventListener("durationchange", bumpFromElement);
      el.removeEventListener("loadedmetadata", bumpFromElement);
      el.removeEventListener("play", handlePlay);
      el.removeEventListener("pause", handlePause);
      el.removeEventListener("ended", handleEnded);
    };
  }, [onEnded, onDurationChange, onPause, onPlay, onTimeUpdate]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || el.paused) return undefined;
    let rafId = 0;
    const tick = () => {
      setCurrentTime(el.currentTime);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

  return {
    alignment,
    segments,
    spokenSegments,
    unspokenSegments,
    currentWord,
    duration,
    currentTime,
    isPlaying,
    hideAudioTags,
    play,
    pause,
    seekToTime,
    startScrubbing,
    endScrubbing,
    audioRef,
  };
}
