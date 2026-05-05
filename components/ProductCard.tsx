import type { ProductData } from "@/types";

type ProductCardProps = {
  product: ProductData;
};

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <section className="overflow-hidden rounded-none border border-border/70 bg-card/90 shadow-xs">
      <div className="grid gap-4 p-5 sm:grid-cols-[160px_1fr] sm:p-6">
        <div className="relative aspect-square w-full overflow-hidden rounded-none border border-border/50 bg-muted/30">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Amazon CDNs vary by locale
            <img
              src={product.imageUrl}
              alt={product.title || "Product"}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No image</div>
          )}
        </div>
        <div className="flex flex-col gap-3.5">
          <h2 className="text-xl font-semibold leading-snug text-foreground">
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
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Highlights
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/90">
                {product.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          )}
          {product.reviews.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Review snippets
              </h3>
              <ul className="mt-2 space-y-2 text-sm italic text-foreground/80">
                {product.reviews.map((r) => (
                  <li key={r} className="border-l-2 border-primary/30 pl-3">
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
