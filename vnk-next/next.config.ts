import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// ═══════════════════════════════════════════════════════════
// Coexistence avec l'Express existant
// Pendant la migration, les routes NON migrées sont proxifiées
// vers l'Express sur :3000. Retirer ce rewrite une fois la
// migration terminée.
// ═══════════════════════════════════════════════════════════
const EXPRESS_PROXY = process.env.EXPRESS_PROXY_URL; // ex: http://localhost:3000

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
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
  async rewrites() {
    if (!EXPRESS_PROXY) return [];
    return {
      // Les routes Next prioritaires (elles sont gérées ici)
      beforeFiles: [],
      // Fallback vers Express pour tout ce qui n'existe pas en Next
      fallback: [
        {
          // L'Express gère encore les PDFs client legacy + tout ce qui n'a pas
          // été migré. Exemples : /api/admin/legacy-endpoint, /stats.xml
          source: "/legacy/:path*",
          destination: `${EXPRESS_PROXY}/:path*`,
        },
      ],
      afterFiles: [],
    };
  },
};

export default withNextIntl(nextConfig);
