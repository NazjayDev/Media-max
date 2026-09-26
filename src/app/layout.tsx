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
    description:
      "Curated movie, TV and anime picks with the same vibe, and exactly where to stream them.",
    url: "https://mediamax.select",
    siteName: "Media Max",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>
          <nav className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-1.5 px-3 py-4 sm:gap-3 sm:px-8">
            <Link
              href="/"
              aria-label="Media Max home"
              className="flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-2 text-sm font-extrabold transition hover:border-accent-from"
            >
              <span aria-hidden>&#8962;</span>
              <span className="hidden bg-gradient-to-r from-accent-from to-accent-to bg-clip-text text-transparent sm:inline">
                Media Max
              </span>
            </Link>
            <div className="flex items-center gap-1.5 sm:gap-3">
              <Link
                href="/ask"
                className="rounded-full border border-accent-from/50 bg-accent-from/10 px-2.5 py-2 text-sm font-semibold transition hover:border-accent-from sm:px-4"
              >
                Ask
              </Link>
              <Link
                href="/together"
                className="hidden rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium transition hover:border-accent-from sm:block"
              >
                Together
              </Link>
              <Link
                href="/trending"
                className="hidden rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium transition hover:border-accent-from sm:block"
              >
                Trending
              </Link>
              <VoiceToggle />
              <AuthButton />
            </div>
          </nav>
          {children}
        </Providers>
      </body>
    </html>
  );
}
