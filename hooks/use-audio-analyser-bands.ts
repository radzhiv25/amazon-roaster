"use client";

import type { MutableRefObject } from "react";
import { useEffect, useState } from "react";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function downsample(freq: Uint8Array, bandCount: number): number[] {
  const out = new Array<number>(bandCount).fill(0);
  if (!freq.length || bandCount <= 0) return out;

  // Perceptual (log-ish) band mapping so activity spreads across the matrix
  // instead of clustering only in low-frequency columns.
  const maxIndex = freq.length - 1;
  for (let b = 0; b < bandCount; b++) {
    const startNorm = b / bandCount;
    const endNorm = (b + 1) / bandCount;
    const from = Math.floor(Math.pow(startNorm, 1.85) * maxIndex);
    let to = Math.floor(Math.pow(endNorm, 1.85) * maxIndex);
    if (to <= from) to = from + 1;
    let sum = 0;
    let count = 0;
    for (let i = from; i < to && i < freq.length; i++) {
      sum += freq[i];
      count++;
    }
    const avg = count ? sum / count / 255 : 0;
    const emphasis = 0.74 + (b / Math.max(1, bandCount - 1)) * 0.52;
    out[b] = Math.min(1, avg * emphasis);
  }
  return out;
}

/** Frequency bands for `Matrix` VU meter; attaches one Web Audio graph while mounted. */

const audioContextByElement = new WeakMap<HTMLAudioElement, AudioContext>();
const sourceByElement = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();
const destinationConnected = new WeakSet<HTMLAudioElement>();

export function useAudioAnalyserBands(
  audioRef: MutableRefObject<HTMLAudioElement | null>,
  bandCount: number
): number[] {
  const [levels, setLevels] = useState<number[]>(() => Array.from({ length: bandCount }, () => 0));

  useEffect(() => {
    const el = audioRef.current;
    const ctor =
      typeof window !== "undefined"
        ? window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (!el || !ctor) return undefined;

    let ctx = audioContextByElement.get(el);
    if (!ctx) {
      ctx = new ctor();
      audioContextByElement.set(el, ctx);
    }

    let source = sourceByElement.get(el);
    if (!source) {
      try {
        source = ctx.createMediaElementSource(el);
        sourceByElement.set(el, source);
      } catch {
        return undefined;
      }
    }

    if (!destinationConnected.has(el)) {
      source.connect(ctx.destination);
      destinationConnected.add(el);
    }

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    let rafId = 0;

    const onPlay = () => {
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
      analyser.disconnect();
      source.disconnect(analyser);
    };
  }, [audioRef, bandCount]);

  return levels;
}
