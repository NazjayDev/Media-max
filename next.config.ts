import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // Browsers must always re-check the service worker so a new deploy is picked up.
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  async redirects() {
    return [{ source: "/watchlist", destination: "/dashboard", permanent: false }];
  },
  images: {
    // Posters come from TMDB already sized (w342) and the free hosting plan caps how many distinct
    // images it will resize each month, so images are served as-is instead of being re-encoded.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
