import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import AuthButton from "@/components/AuthButton";
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
  title: "Media Max",
  description: "Find your next watch based on what you already love.",
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
            <VoiceToggle />
            <AuthButton />
          </nav>
          {children}
        </Providers>
      </body>
    </html>
  );
}
