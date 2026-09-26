import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Media Max",
    short_name: "Media Max",
    description: "Select your next watch: movie, TV and anime picks with where to stream them.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f0c0a",
    theme_color: "#0f0c0a",
    categories: ["entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Long-pressing the app icon on Android shows these.
    shortcuts: [
      { name: "Ask Media Max", url: "/ask" },
      { name: "Watch Together", url: "/together" },
      { name: "Trending", url: "/trending" },
    ],
  };
}
