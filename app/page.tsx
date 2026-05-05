"use client";

import { RoastAudioExperience } from "@/components/RoastAudioExperience";
import {
  SettingsDialog,
  applyThemePreference,
  clearSensitiveSettings,
  getStoredSettings,
  getStoredThemePreference,
} from "@/components/SettingsDialog";
import type { ApiResponse } from "@/types";
import type { ComponentType } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AudioLines, Link2, Mic, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { ProductCard } from "@/components/ProductCard";
import { RoastCard } from "@/components/RoastCard";
import { UrlInput } from "@/components/UrlInput";

const LOADING_LINES = [
  "Scanning listing data...",
  "Drafting the roast...",
  "Tuning the narrator voice...",
  "Checking product highlights...",
  "Finding the best punchline...",
  "Balancing roast intensity...",
  "Composing narration timing...",
  "Polishing transcript flow...",
  "Finalizing voice output...",
  "Running one more quality pass...",
  "Aligning script and playback...",
  "Preparing final response...",
  "Making the roast cleaner...",
  "Locking in the final draft...",
  "Almost there...",
];
const LOADING_FALLBACK_LINES = [
  "Still cooking... this one is taking longer than usual.",
  "Hold tight... we are finishing the response.",
  "Nearly done... applying final checks.",
];
const LOADING_STEP_MS = 3000;
const LOADING_BUFFER_MS = 45000;

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loadingLine, setLoadingLine] = useState(0);
  const [loadingElapsedMs, setLoadingElapsedMs] = useState(0);
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    applyThemePreference(getStoredThemePreference());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemePreference(getStoredThemePreference());
    media.addEventListener("change", onChange);
    return () => {
      media.removeEventListener("change", onChange);
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, []);

  const canShowResults = useMemo(() => Boolean(result), [result]);

  useEffect(() => {
    if (!loading) return;
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setLoadingElapsedMs(elapsed);
      const idx = Math.floor(elapsed / LOADING_STEP_MS);
      setLoadingLine(idx);
    }, 250);
    return () => window.clearInterval(id);
  }, [loading]);

  const handleRoast = useCallback(async () => {
    setError(null);
    setLoading(true);
    setLoadingLine(0);
    setLoadingElapsedMs(0);
    setResult(null);
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setAudioUrl(null);

    try {
      // Get user settings to send to API
      const settings = getStoredSettings();
      const mode = settings.roastMode || "standard";
      
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, mode, settings }),
      });
      const data = (await res.json()) as ApiResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Request failed.");
      }
      setResult(data);
      toast.success("Roast generated");
      if (settings.clearKeysAfterUse) {
        clearSensitiveSettings();
        toast.success("Local API keys cleared after successful run");
      }
      if (data.audio) {
        const nextUrl = base64ToBlobUrl(data.audio);
        audioUrlRef.current = nextUrl;
        setAudioUrl(nextUrl);
      } else {
        setAudioUrl(null);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-linear-to-b from-background via-muted/20 to-background font-sans">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-7 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {/* Settings button in top right */}
        <div className="absolute right-4 top-4 z-10">
          <SettingsDialog />
        </div>
        
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-3"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
            Amazon Roaster
          </p>
          <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-5xl">
            Paste a listing. Hear the judgment.
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-muted-foreground">
            Drop in any Amazon product link. We grab the listing details, generate a funny roast, then create a voice
            version you can play right here.
          </p>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="grid gap-2 rounded-none border border-border/70 bg-card/70 p-4 shadow-xs backdrop-blur-sm sm:grid-cols-3 sm:p-5"
        >
          <HowItWorks icon={WandSparkles} title="1) Configure settings" text="Pick mode, voice, and provider keys from the gear icon." />
          <HowItWorks icon={Link2} title="2) Paste link" text="Copy the product page URL from Amazon." />
          <HowItWorks icon={AudioLines} title="3) Roast + play audio" text="Generate, listen instantly, or copy the script." />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="rounded-none border border-border/70 bg-card/80 p-5 shadow-xs backdrop-blur-sm sm:p-6"
        >
          <UrlInput
            url={url}
            loading={loading}
            onUrlChange={setUrl}
            onSubmit={handleRoast}
          />
        </motion.section>

        <AnimatePresence mode="popLayout">
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="max-w-xl text-base font-medium tracking-tight text-muted-foreground"
            >
              <AnimatePresence mode="wait">
                <motion.p
                  key={
                    loadingElapsedMs <= LOADING_BUFFER_MS
                      ? `buffer-${Math.min(loadingLine, LOADING_LINES.length - 1)}`
                      : `fallback-${Math.floor((loadingElapsedMs - LOADING_BUFFER_MS) / LOADING_STEP_MS)}`
                  }
                  initial={{ opacity: 0, y: 6, filter: "blur(2px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -6, filter: "blur(2px)" }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="text-base font-semibold text-foreground/85"
                >
                  {loadingElapsedMs <= LOADING_BUFFER_MS
                    ? LOADING_LINES[Math.min(loadingLine, LOADING_LINES.length - 1)]
                    : LOADING_FALLBACK_LINES[
                        Math.floor((loadingElapsedMs - LOADING_BUFFER_MS) / LOADING_STEP_MS) %
                          LOADING_FALLBACK_LINES.length
                      ]}
                </motion.p>
              </AnimatePresence>
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
              className="rounded-none border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-xs"
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
              <p className="rounded-none border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-foreground">
                Voice output is off (<code className="rounded-none bg-primary/20 px-1 font-mono">SKIP_TTS</code>). You can
                still copy the roast script and use any TTS tool.
              </p>
            )}
            <ProductCard product={result.product} />
            <RoastCard roast={result.roast} verdict={result.verdict} />
            {result.audio && !result.ttsSkipped && (
              <section className="space-y-2 rounded-none border border-border/70 bg-card/90 p-4 shadow-xs">
                <div className="inline-flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                  <Mic className="h-4 w-4 text-primary" />
                  <span>Listen to the roast</span>
                  {result.ttsProvider === "elevenlabs" && result.alignment ? (
                    <span className="text-muted-foreground font-normal uppercase">
                      primary provider with precise timing
                    </span>
                  ) : null}
                  {result.ttsProvider === "elevenlabs" && !result.alignment ? (
                    <span className="text-muted-foreground font-normal uppercase">
                      primary provider audio (timing fallback)
                    </span>
                  ) : null}
                  {result.ttsProvider === "noiz" ? (
                    <span className="text-muted-foreground font-normal uppercase">
                      fallback provider (estimated timing from duration)
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
    <div className="rounded-none border border-border/70 bg-card/80 px-3 py-2.5">
      <div className="mb-1.5 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <p className="text-sm leading-snug text-muted-foreground">{text}</p>
    </div>
  );
}
