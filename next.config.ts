import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship raw TypeScript and are compiled by Next.
  transpilePackages: ["@hudhod/core", "@hudhod/sdk", "@hudhod/react"],
  // Required for WebContainers (SharedArrayBuffer / cross-origin isolation).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
