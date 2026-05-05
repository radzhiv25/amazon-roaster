"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

type RoastCardProps = {
  roast: string;
  verdict: string;
};

function buildSpokenScript(roast: string, verdict: string) {
  const v = verdict.trim();
  return v ? `${roast.trim()}\n\n${v}` : roast.trim();
}

export function RoastCard({ roast, verdict }: RoastCardProps) {
  const [copied, setCopied] = useState(false);

  const copyScript = useCallback(async () => {
    try {
      const text = buildSpokenScript(roast, verdict);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Roast script copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy roast script");
    }
  }, [roast, verdict]);

  return (
    <section className="space-y-4 rounded-none border border-border/70 bg-card/90 p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => void copyScript()}
          className="shrink-0 rounded-none border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs transition hover:bg-muted active:scale-[0.98]"
        >
          {copied ? "Copied" : "Copy script"}
        </button>
      </div>
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground sm:text-base">{roast}</p>
      {verdict && (
        <p className="border-t border-dashed border-border pt-4 text-lg font-semibold text-primary">
          {verdict}
        </p>
      )}
    </section>
  );
}
