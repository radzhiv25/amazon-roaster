import "server-only";
import { chromium } from "playwright";
import type { ProductData } from "@/types";

const STEALTH_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const SCRAPE_TIMEOUT_MS = 15_000;

function emptyProduct(): ProductData {
  return {
    title: "",
    brand: "",
    price: "",
    rating: "",
    reviewCount: "",
    bullets: [],
    reviews: [],
    imageUrl: "",
  };
}

function isAmazonHostname(hostname: string): boolean {
  return /(^|\.)amazon\.(com|co\.uk|de|fr|es|it|ca|in|co\.jp|com\.au|com\.mx|com\.br|nl|se|pl|sg|ae|sa|eg|tr)$/i.test(
    hostname,
  );
}

export function assertAmazonProductUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Invalid product URL.");
  }
  if (!isAmazonHostname(url.hostname)) {
    throw new Error("Only Amazon storefront URLs are supported.");
  }
  if (!url.pathname || url.pathname === "/") {
    throw new Error("Paste a specific product page URL.");
  }
  return url;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

export async function scrapeAmazonProduct(productUrl: string): Promise<ProductData> {
  const url = assertAmazonProductUrl(productUrl);

  return withTimeout(
    (async () => {
      const browser = await chromium.launch({
        headless: true,
        args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
      });

      try {
        const context = await browser.newContext({
          userAgent: STEALTH_USER_AGENT,
          locale: "en-US",
          viewport: { width: 1280, height: 900 },
        });
        const page = await context.newPage();
        page.setDefaultTimeout(SCRAPE_TIMEOUT_MS);

        await page.goto(url.toString(), {
          waitUntil: "domcontentloaded",
        });

        const data = await page.evaluate(() => {
          const text = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

          const title =
            text(document.querySelector("#productTitle")) ||
            text(document.querySelector('h1 span[id="productTitle"]'));

          let brand = text(document.querySelector("#bylineInfo"));
          if (!brand) {
            brand = text(document.querySelector("tr.po-brand td.po-break-word"));
          }
          if (!brand) {
            brand = text(document.querySelector("#brand"));
          }

          const priceEl =
            document.querySelector("#corePrice_feature_div .a-price .a-offscreen") ||
            document.querySelector(".a-price .a-offscreen") ||
            document.querySelector("#apex_desktop .a-price .a-offscreen");
          const price = text(priceEl);

          let rating = "";
          const pop = document.querySelector("#acrPopover");
          if (pop?.getAttribute("title")) {
            rating = pop.getAttribute("title")!.replace(/\s+/g, " ").trim();
          }
          if (!rating) {
            const alt = document.querySelector("#averageCustomerReviews i.a-icon-star .a-icon-alt");
            rating = text(alt);
          }

          let reviewCount = text(document.querySelector("#acrCustomerReviewText"));
          if (!reviewCount) {
            reviewCount = text(document.querySelector("#acrCustomerReviewLink #acrCustomerReviewText"));
          }

          const bulletNodes = Array.from(
            document.querySelectorAll("#feature-bullets ul li span.a-list-item"),
          );
          const bullets = bulletNodes
            .map((n) => text(n))
            .filter((b) => b.length > 0 && !/^see more$/i.test(b))
            .slice(0, 5);

          const reviewBlocks = Array.from(document.querySelectorAll('[data-hook="review"]'));
          const reviews = reviewBlocks
            .map((block) => {
              const body =
                block.querySelector('[data-hook="review-body"] span') ||
                block.querySelector(".review-text-content span");
              return text(body);
            })
            .filter((r) => r.length > 20)
            .slice(0, 3);

          let imageUrl = "";
          const landing = document.querySelector<HTMLImageElement>("#landingImage");
          if (landing?.src) {
            imageUrl = landing.src;
          }
          if (!imageUrl) {
            const imgBlk = document.querySelector<HTMLImageElement>("#imgBlkFront");
            if (imgBlk?.src) {
              imageUrl = imgBlk.src;
            }
          }
          if (!imageUrl) {
            const main = document.querySelector<HTMLImageElement>("#main-image-container img");
            if (main?.src) {
              imageUrl = main.src;
            }
          }

          return {
            title,
            brand,
            price,
            rating,
            reviewCount,
            bullets,
            reviews,
            imageUrl,
          };
        });

        const merged: ProductData = { ...emptyProduct(), ...data };

        if (!merged.title && !merged.price && !merged.imageUrl) {
          throw new Error(
            "Could not read product details. The page may be blocked, captcha-gated, or not a product listing.",
          );
        }

        return merged;
      } finally {
        await browser.close();
      }
    })(),
    SCRAPE_TIMEOUT_MS,
    "Product scrape",
  );
}
