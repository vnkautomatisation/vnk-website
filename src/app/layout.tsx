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
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "VNK Automatisation",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0F2D52",
};

import { PwaRegister } from "@/components/pwa-register";

// Filtre dev-only : Next.js 15 + HMR re-emet des <link rel=preload as=style>
// pour chaque rebuild Fast Refresh, et Chrome warn "preloaded but not used".
// Aucun impact en prod (build sans HMR). cssChunking=strict aide mais ne
// supprime pas tous les cas. Patch console.warn pour ignorer ce message
// precis, garde tous les autres warnings utiles.
const DEV_CONSOLE_FILTER = `
(function() {
  if (typeof window === 'undefined') return;
  var orig = console.warn.bind(console);
  console.warn = function() {
    var msg = arguments[0];
    if (typeof msg === 'string' && msg.indexOf('was preloaded using link preload but not used') !== -1) {
      return; // Bruit Next.js 15 dev mode, on ignore
    }
    return orig.apply(null, arguments);
  };
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={inter.variable} suppressHydrationWarning>
      <head>
        {process.env.NODE_ENV !== "production" && (
          <script
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: DEV_CONSOLE_FILTER }}
          />
        )}
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
