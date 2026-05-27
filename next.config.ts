import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  serverExternalPackages: [
    "pdfkit",
    "fontkit",
    "restructure",
    "iconv-lite",
    "puppeteer-core",
    "@sparticuz/chromium",
  ],
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
    // Note: "sonner" retiré car bug Next.js — son barrel-optimize duplique l'import
    // de `toast` dans les fichiers qui en importent ET importent un autre composant
    // qui en importe aussi (ex: vacation-window-banner → appel SubmitAppealDialog).
    // Cf. https://github.com/vercel/next.js/issues/57966 (similaire)
    optimizePackageImports: ["lucide-react"],
    // Fix warning Chrome dev "was preloaded using link preload but not used".
    // Cause : Next.js 15 par defaut emet `<link rel="preload" as="style">` pour
    // chaque chunk CSS de route (cssChunking='loose'), mais la balise
    // `<link rel="stylesheet">` correspondante est injectee plus tard par JS
    // apres `window.load`, donc le browser considere la preload non utilisee.
    // 'strict' charge les CSS dans l'ordre d'import (synchrone, sans preload
    // separe en avance), ce qui supprime le warning.
    // Cf. https://github.com/vercel/next.js/issues/63265
    cssChunking: "strict",
  },
  // Reduce cold starts
  reactStrictMode: false,
  // Masque les warnings webpack infrastructure inoffensifs :
  //   - "Serializing big strings (>128 kiB)..." (impact négligeable)
  //   - "ENOENT ... .pack.gz_ -> .pack.gz" (bug rename Windows)
  // Les vrais warnings/errors restent visibles.
  webpack: (config) => {
    config.infrastructureLogging = {
      ...config.infrastructureLogging,
      level: "error",
    };
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
