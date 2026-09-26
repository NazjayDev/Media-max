import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
