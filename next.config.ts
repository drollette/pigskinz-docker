import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // No `output: "standalone"` here -- that mode generates its own server.js
  // and traces dependencies from the app router tree only, which would miss
  // ws/better-sqlite3/node-cron (used by server.ts's custom server and cron
  // loop, not by any Next page/route). The Dockerfile instead installs a
  // full production node_modules and runs server.ts directly. See
  // server.ts and Dockerfile.

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
