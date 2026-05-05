import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Keep runtime browser binaries as external node_modules on server builds. */
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core", "playwright"],
  outputFileTracingIncludes: {
    "/api/roast": ["./node_modules/@sparticuz/chromium/**"],
  },
  /**
   * Noiz TTS is invoked only from Route Handlers.
   * If you later call external audio APIs from the browser, add `headers()` as needed (e.g. CSP).
   */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }],
      },
    ];
  },
};

export default nextConfig;
