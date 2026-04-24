import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const lato = localFont({
  variable: "--font-lato",
  src: [
    { path: "./fonts/Lato-Light.ttf", weight: "300", style: "normal" },
    { path: "./fonts/Lato-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/Lato-Italic.ttf", weight: "400", style: "italic" },
    { path: "./fonts/Lato-Bold.ttf", weight: "700", style: "normal" },
    { path: "./fonts/Lato-Black.ttf", weight: "900", style: "normal" },
  ],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DropDoc",
  description: "Upload and share HTML client reports",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${lato.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--surface-0)] text-[var(--text-primary)]">
        {children}
      </body>
    </html>
  );
}
