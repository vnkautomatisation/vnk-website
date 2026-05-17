import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  serverExternalPackages: ["pdfkit", "fontkit", "restructure", "iconv-lite"],
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
    optimizePackageImports: ["lucide-react", "sonner"],
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
