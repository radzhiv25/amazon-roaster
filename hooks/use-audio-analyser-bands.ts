"use client";

import type { MutableRefObject } from "react";
import { useEffect, useState } from "react";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function downsample(freq: Uint8Array, bandCount: number): number[] {
  const out = new Array<number>(bandCount).fill(0);
  if (!freq.length || bandCount <= 0) return out;

  for (let b = 0; b < bandCount; b++) {
    const from = Math.floor((b * freq.length) / bandCount);
    let to = Math.floor(((b + 1) * freq.length) / bandCount);
    if (to <= from) to = from + 1;
    let sum = 0;
    let count = 0;
    for (let i = from; i < to && i < freq.length; i++) {
      sum += freq[i];
      count++;
    }
    out[b] = count ? sum / count / 255 : 0;
  }
  return out;
}

/** Frequency bands for `Matrix` VU meter; attaches one Web Audio graph while mounted. */

export function useAudioAnalyserBands(
  audioRef: MutableRefObject<HTMLAudioElement | null>,
  bandCount: number
): number[] {
  const [levels, setLevels] = useState<number[]>(() => Array.from({ length: bandCount }, () => 0));

  useEffect(() => {
    setLevels(Array.from({ length: bandCount }, () => 0));
  }, [bandCount]);

  useEffect(() => {
    const el = audioRef.current;
    const ctor =
      typeof window !== "undefined"
        ? window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (!el || !ctor) return undefined;

    const ctx = new ctor();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;

    let source: MediaElementAudioSourceNode;
    try {
      source = ctx.createMediaElementSource(el);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      console.log("[useAudioAnalyserBands] Web Audio API connected, ctx.state:", ctx.state);
    } catch (e) {
      console.error("[useAudioAnalyserBands] Web Audio API error:", e);
      void ctx.close().catch(() => {});
      return undefined;
    }

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    let rafId = 0;

    const onPlay = () => {
      console.log("[useAudioAnalyserBands] play event, resuming ctx, state:", ctx.state);
      void ctx.resume();
    };

    el.addEventListener("play", onPlay);

    const loop = () => {
      analyser.getByteFrequencyData(buffer);
      setLevels(downsample(buffer, bandCount).map(clamp01));
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      el.removeEventListener("play", onPlay);
      source.disconnect();
      analyser.disconnect();
      void ctx.close().catch(() => {});
    };
  }, [audioRef, bandCount]);

  return levels;
}
