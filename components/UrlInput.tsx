"use client";

import type { RoastMode, VoiceGender } from "@/types";

type UrlInputProps = {
  url: string;
  mode: RoastMode;
  voiceGender: VoiceGender;
  loading: boolean;
  onUrlChange: (value: string) => void;
  onModeChange: (mode: RoastMode) => void;
  onVoiceGenderChange: (gender: VoiceGender) => void;
  onSubmit: () => void;
};

const MODE_OPTIONS: { value: RoastMode; label: string; hint: string }[] = [
  { value: "standard", label: "Standard", hint: "Classic Brenda" },
  { value: "harder", label: "Harder", hint: "More heat" },
  { value: "reRoast", label: "Re-roast", hint: "Fresh angles" },
];

const VOICE_GENDER_OPTIONS: { value: VoiceGender; label: string; hint: string }[] = [
  { value: "female", label: "Woman voice", hint: "From your ElevenLabs female ID" },
  { value: "male", label: "Man voice", hint: "From your ElevenLabs male ID" },
];

export function UrlInput({
  url,
  mode,
  voiceGender,
  loading,
  onUrlChange,
  onModeChange,
  onVoiceGenderChange,
  onSubmit,
}: UrlInputProps) {
  return (
    <div className="flex w-full flex-col gap-5">
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
        Amazon product URL
        <input
          type="url"
          name="amazon-url"
          autoComplete="off"
          placeholder="https://www.amazon.com/dp/..."
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none ring-amber-500/30 transition placeholder:text-zinc-400 focus:border-amber-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500"
        />
      </label>

      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-2 w-full text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Roast mode
        </legend>
        {MODE_OPTIONS.map((opt) => {
          const selected = mode === opt.value;
          return (
            <label
              key={opt.value}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                selected
                  ? "border-amber-500 bg-amber-50 text-amber-950 dark:border-amber-400 dark:bg-amber-950/40 dark:text-amber-100"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              <input
                type="radio"
                className="sr-only"
                name="roast-mode"
                value={opt.value}
                checked={selected}
                onChange={() => onModeChange(opt.value)}
              />
              <span className="font-semibold">{opt.label}</span>
              <span className="text-xs opacity-80">{opt.hint}</span>
            </label>
          );
        })}
      </fieldset>

      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-2 w-full text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Voice persona
        </legend>
        {VOICE_GENDER_OPTIONS.map((opt) => {
          const selected = voiceGender === opt.value;
          return (
            <label
              key={opt.value}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                selected
                  ? "border-violet-500 bg-violet-50 text-violet-950 dark:border-violet-400 dark:bg-violet-950/40 dark:text-violet-100"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              <input
                type="radio"
                className="sr-only"
                name="voice-persona"
                value={opt.value}
                checked={selected}
                onChange={() => onVoiceGenderChange(opt.value)}
              />
              <span className="font-semibold">{opt.label}</span>
              <span className="text-xs opacity-80">{opt.hint}</span>
            </label>
          );
        })}
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Tip: product pages with visible reviews roast better.</p>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading || !url.trim()}
          className="inline-flex min-w-30 items-center justify-center rounded-lg bg-linear-to-r from-amber-500 to-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_2px_0_rgba(146,64,14,0.85),0_10px_24px_rgba(245,158,11,0.35)] transition hover:-translate-y-0.5 hover:from-amber-400 hover:to-orange-500 hover:shadow-[0_3px_0_rgba(146,64,14,0.9),0_14px_28px_rgba(245,158,11,0.42)] active:translate-y-0 active:shadow-[0_1px_0_rgba(146,64,14,0.9),0_6px_14px_rgba(245,158,11,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Roasting..." : "Roast it"}
        </button>
      </div>
    </div>
  );
}
