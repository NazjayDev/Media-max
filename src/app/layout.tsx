import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Montserrat } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import FeedbackButton from "@/components/FeedbackButton";
import ServiceWorker from "@/components/ServiceWorker";
import SiteHeader from "@/components/SiteHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#0f0c0a",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  applicationName: "Media Max",
  // Lets iPhones open the site full-screen from the home screen with a dark status bar.
  appleWebApp: { capable: true, title: "Media Max", statusBarStyle: "black" },
  formatDetection: { telephone: false },
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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <SiteHeader />
          {children}
          <FeedbackButton />
          <ServiceWorker />
        </Providers>
      </body>
    </html>
  );
}
