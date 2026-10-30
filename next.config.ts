import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Old single-page routes, from before the dashboard got sections.
  async redirects() {
    return [
      { source: "/week/:week", destination: "/reports?week=:week", permanent: false },
      { source: "/sources", destination: "/repositories/manage", permanent: false },
    ];
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "avatars.githubusercontent.com" }],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
