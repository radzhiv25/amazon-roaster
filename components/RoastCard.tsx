"use client";

import { useCallback, useState } from "react";
import type { Badge } from "@/types";

type RoastCardProps = {
  roast: string;
  verdict: string;
  badges: Badge[];
};

const BADGE_STYLES: Record<Badge["type"], string> = {
  red: "bg-rose-50 text-rose-900 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-100 dark:ring-rose-900",
  amber:
    "bg-amber-50 text-amber-950 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-50 dark:ring-amber-900",
  green:
    "bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-50 dark:ring-emerald-900",
};

function buildSpokenScript(roast: string, verdict: string) {
  const v = verdict.trim();
  return v ? `${roast.trim()}\n\n${v}` : roast.trim();
}

export function RoastCard({ roast, verdict, badges }: RoastCardProps) {
  const [copied, setCopied] = useState(false);

  const copyScript = useCallback(async () => {
    const text = buildSpokenScript(roast, verdict);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [roast, verdict]);

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-200 bg-linear-to-b from-white via-zinc-50 to-zinc-100/70 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <header className="flex flex-wrap gap-2">
          {badges.map((badge, index) => (
            <span
              key={`${badge.type}-${badge.label}-${index}`}
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${BADGE_STYLES[badge.type]}`}
            >
              {badge.label}
            </span>
          ))}
        </header>
        <button
          type="button"
          onClick={() => void copyScript()}
          className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          {copied ? "Copied" : "Copy script"}
        </button>
      </div>
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-900 dark:text-zinc-100 sm:text-base">{roast}</p>
      {verdict && (
        <p className="border-t border-dashed border-zinc-200 pt-4 text-lg font-semibold text-orange-700 dark:border-zinc-700 dark:text-orange-300">
          {verdict}
        </p>
      )}
    </section>
  );
}
