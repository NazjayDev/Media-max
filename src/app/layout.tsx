import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import AuthButton from "@/components/AuthButton";
import Link from "next/link";
import VoiceToggle from "@/components/VoiceToggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://mediamax.select"),
  title: "Media Max: select your next watch",
  description:
    "Search a movie, show, or anime, or describe a vibe, and select your next watch from AI-refined recommendations with streaming links.",
  openGraph: {
    title: "Media Max: select your next watch",
    description: "Curated movie, TV and anime picks with the same vibe, and exactly where to stream them.",
    url: "https://mediamax.select",
    siteName: "Media Max",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <nav className="absolute inset-x-0 top-0 z-20 flex items-center justify-end gap-3 px-4 py-4 sm:px-8">
            <Link
              href="/trending"
              className="hidden rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium transition hover:border-accent-from sm:block"
            >
              Trending
            </Link>
            <VoiceToggle />
            <AuthButton />
          </nav>
          {children}
        </Providers>
      </body>
    </html>
  );
}
