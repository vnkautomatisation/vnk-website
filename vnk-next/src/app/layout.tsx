// Root layout (applies to all locales)
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vnk.ca"),
  title: {
    default: "VNK Automatisation Inc.",
    template: "%s | VNK Automatisation Inc.",
  },
  description:
    "Services d'automatisation industrielle : support PLC, SCADA, HMI, audit, documentation. Québec.",
  applicationName: "VNK Automatisation",
  authors: [{ name: "Yan Verone Kengne" }],
  keywords: [
    "automatisation industrielle",
    "PLC",
    "SCADA",
    "HMI",
    "Siemens",
    "Rockwell",
    "Québec",
  ],
  openGraph: {
    type: "website",
    siteName: "VNK Automatisation Inc.",
    images: ["/images/vnk-twitter-card-1200x600.png"],
  },
  twitter: {
    card: "summary_large_image",
  },
  icons: {
    icon: [
      { url: "/favicon/favicon-16x16.png", sizes: "16x16" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32" },
    ],
    apple: [{ url: "/favicon/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/favicon/site.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0F2D52",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
