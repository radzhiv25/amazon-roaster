import type { ProductData } from "@/types";

type ProductCardProps = {
  product: ProductData;
};

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-100">{value}</dd>
    </div>
  );
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white/95 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="grid gap-4 p-5 sm:grid-cols-[160px_1fr] sm:p-6">
        <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-zinc-100 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Amazon CDNs vary by locale
            <img
              src={product.imageUrl}
              alt={product.title || "Product"}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-zinc-400">No image</div>
          )}
        </div>
        <div className="flex flex-col gap-3.5">
          <h2 className="text-xl font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
            {product.title || "Unknown product"}
          </h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Brand" value={product.brand} />
            <Field label="Price" value={product.price} />
            <Field label="Rating" value={product.rating} />
            <Field label="Reviews" value={product.reviewCount} />
          </dl>
          {product.bullets.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Highlights
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-800 dark:text-zinc-200">
                {product.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          )}
          {product.reviews.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Review snippets
              </h3>
              <ul className="mt-2 space-y-2 text-sm italic text-zinc-700 dark:text-zinc-300">
                {product.reviews.map((r) => (
                  <li key={r} className="border-l-2 border-amber-200 pl-3 dark:border-amber-800">
                    “{r}”
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
