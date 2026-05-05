import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
