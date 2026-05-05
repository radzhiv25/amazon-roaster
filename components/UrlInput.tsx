"use client";

type UrlInputProps = {
  url: string;
  loading: boolean;
  onUrlChange: (value: string) => void;
  onSubmit: () => void;
};

export function UrlInput({
  url,
  loading,
  onUrlChange,
  onSubmit,
}: UrlInputProps) {
  return (
    <div className="flex w-full flex-col gap-5">
      <label className="flex flex-col gap-2 text-sm font-medium text-muted-foreground">
        Amazon product URL
        <input
          type="url"
          name="amazon-url"
          autoComplete="off"
          placeholder="https://www.amazon.com/dp/..."
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          className="w-full rounded-none border border-border bg-background px-4 py-3 text-base text-foreground shadow-xs outline-none ring-primary/30 transition placeholder:text-muted-foreground focus:border-primary focus:ring-3"
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Tip: product pages with visible reviews roast better.</p>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading || !url.trim()}
          className="inline-flex min-w-30 items-center justify-center rounded-none bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Roasting..." : "Roast it"}
        </button>
      </div>
    </div>
  );
}
