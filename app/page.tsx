"use client";

import { RoastAudioExperience } from "@/components/RoastAudioExperience";
import type { ApiResponse, RoastMode, VoiceGender } from "@/types";
import type { ComponentType } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AudioLines, Link2, Mic, WandSparkles } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { RoastCard } from "@/components/RoastCard";
import { UrlInput } from "@/components/UrlInput";
import { ShimmeringText } from "@/components/ui/shimmering-text";

function base64ToBlobUrl(base64: string, mimeType = "audio/mpeg"): string {
  // Remove any data URL prefix if present
  const base64Data = base64.replace(/^data:[^;]+;base64,/, "");
  
  // Decode base64 using a more robust method
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<RoastMode>("standard");
  const [voiceGender, setVoiceGender] = useState<VoiceGender>("female");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, []);

  const canShowResults = useMemo(() => Boolean(result), [result]);

  const handleRoast = useCallback(async () => {
    setError(null);
    setLoading(true);
    setResult(null);
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setAudioUrl(null);

    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, mode, voiceGender }),
      });
      const data = (await res.json()) as ApiResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Request failed.");
      }
      setResult(data);
      if (data.audio) {
        console.log("[handleRoast] Received audio, length:", data.audio.length);
        const nextUrl = base64ToBlobUrl(data.audio);
        console.log("[handleRoast] Created blob URL:", nextUrl);
        audioUrlRef.current = nextUrl;
        setAudioUrl(nextUrl);
      } else {
        console.log("[handleRoast] No audio received");
        setAudioUrl(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [mode, url, voiceGender]);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-linear-to-b from-amber-50/50 via-zinc-50 to-zinc-100 font-sans dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-7 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-3"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700 dark:text-amber-400">
            Amazon Roaster
          </p>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white sm:text-5xl">
            Paste a listing. Hear the judgment.
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            Drop in any Amazon product link. We grab the listing details, generate a funny roast, then create a voice
            version you can play right here.
          </p>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="grid gap-2 rounded-2xl border border-zinc-200/80 bg-white/85 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80 sm:grid-cols-3 sm:p-5"
        >
          <HowItWorks icon={Link2} title="1) Paste link" text="Copy the product page URL from Amazon." />
          <HowItWorks icon={WandSparkles} title="2) Roast generated" text="The app writes a short, savage script." />
          <HowItWorks icon={AudioLines} title="3) Play audio" text="Listen instantly or copy the script." />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80 sm:p-6"
        >
          <UrlInput
            url={url}
            mode={mode}
            voiceGender={voiceGender}
            loading={loading}
            onUrlChange={setUrl}
            onModeChange={setMode}
            onVoiceGenderChange={setVoiceGender}
            onSubmit={handleRoast}
          />
        </motion.section>

        <AnimatePresence mode="popLayout">
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="max-w-xl text-base font-medium tracking-tight text-zinc-600 dark:text-zinc-400"
            >
              <ShimmeringText
                duration={3.25}
                spread={3}
                repeatDelay={2}
                className=""
                shimmerColor="#fbbf24"
                color="rgba(113,113,122,1)"
                text="Scouting the listing, sharpening the verdict, syncing the narrator… hang tight."
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.div
              role="alert"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="rounded-xl border border-rose-200 bg-rose-50/95 px-4 py-3 text-sm text-rose-900 shadow-sm dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {canShowResults && result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-5 sm:gap-6"
          >
            {result.ttsSkipped && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                Voice output is off (<code className="rounded bg-amber-100/80 px-1 font-mono dark:bg-amber-900/50">SKIP_TTS</code>). You can
                still copy the roast script and use any TTS tool.
              </p>
            )}
            <ProductCard product={result.product} />
            <RoastCard roast={result.roast} verdict={result.verdict} badges={result.badges} />
            {result.audio && !result.ttsSkipped && (
              <section className="space-y-2 rounded-2xl border border-zinc-200 bg-white/95 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/90">
                <div className="inline-flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  <Mic className="h-4 w-4 text-amber-500" />
                  <span>Listen to the roast</span>
                  {result.ttsProvider === "elevenlabs" && result.alignment ? (
                    <span className="text-muted-foreground font-normal uppercase">
                      karaoke timing from ElevenLabs
                    </span>
                  ) : null}
                  {result.ttsProvider === "elevenlabs" && !result.alignment ? (
                    <span className="text-muted-foreground font-normal uppercase">
                      elevenlabs audio (timing fallback)
                    </span>
                  ) : null}
                  {result.ttsProvider === "noiz" ? (
                    <span className="text-muted-foreground font-normal uppercase">
                      narrator via Noiz (estimated timing from duration)
                    </span>
                  ) : null}
                </div>
                <RoastAudioExperience roastText={result.roast} audioBlobUrl={audioUrl} alignmentProp={result.alignment} />
              </section>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}

function HowItWorks({
  icon: Icon,
  title,
  text,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200/70 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/70">
      <div className="mb-1.5 inline-flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
        <Icon className="h-4 w-4 text-amber-500" />
        {title}
      </div>
      <p className="text-sm leading-snug text-zinc-600 dark:text-zinc-400">{text}</p>
    </div>
  );
}
