// ============================================================
// Parser User-Agent simple (sans dependance externe)
// Detecte browser + OS + deviceType + label propre.
// Pour un parsing complet on pourrait installer ua-parser-js,
// mais ici on prefere zero dep pour reduire bundle/audit.
// ============================================================

export type ParsedUA = {
  browser: string;       // "Chrome 122", "Safari", "Firefox"
  os: string;            // "macOS", "Windows 11", "iOS 18"
  deviceType: "desktop" | "mobile" | "tablet";
  label: string;         // "Chrome sur macOS" pour affichage
};

const BROWSERS: { test: RegExp; name: string }[] = [
  { test: /Edg\/(\d+)/, name: "Edge" },
  { test: /OPR\/(\d+)/, name: "Opera" },
  { test: /Chrome\/(\d+)/, name: "Chrome" },
  { test: /Firefox\/(\d+)/, name: "Firefox" },
  { test: /Version\/(\d+).*Safari/, name: "Safari" },
  { test: /Safari\/(\d+)/, name: "Safari" },
];

const OS_MAP: { test: RegExp; name: string }[] = [
  { test: /Windows NT 10\.0/, name: "Windows 10/11" },
  { test: /Windows NT 6\.3/, name: "Windows 8.1" },
  { test: /Windows NT 6\.2/, name: "Windows 8" },
  { test: /Windows NT 6\.1/, name: "Windows 7" },
  { test: /Windows/, name: "Windows" },
  { test: /Mac OS X (\d+)[._](\d+)/, name: "macOS" },
  { test: /Macintosh/, name: "macOS" },
  { test: /Android (\d+)/, name: "Android" },
  { test: /iPhone OS (\d+)/, name: "iOS" },
  { test: /iPad/, name: "iPadOS" },
  { test: /Linux/, name: "Linux" },
];

export function parseUserAgent(ua: string | null | undefined): ParsedUA {
  if (!ua) {
    return { browser: "Inconnu", os: "Inconnu", deviceType: "desktop", label: "Appareil inconnu" };
  }

  // Browser
  let browser = "Inconnu";
  for (const b of BROWSERS) {
    const m = ua.match(b.test);
    if (m) {
      browser = m[1] ? `${b.name} ${m[1]}` : b.name;
      break;
    }
  }

  // OS
  let os = "Inconnu";
  for (const o of OS_MAP) {
    const m = ua.match(o.test);
    if (m) {
      if (o.name === "macOS" && m[1] && m[2]) {
        os = `macOS ${m[1]}.${m[2].replace("_", ".")}`;
      } else if (o.name === "iOS" && m[1]) {
        os = `iOS ${m[1]}`;
      } else if (o.name === "Android" && m[1]) {
        os = `Android ${m[1]}`;
      } else {
        os = o.name;
      }
      break;
    }
  }

  // Device type
  let deviceType: "desktop" | "mobile" | "tablet" = "desktop";
  if (/iPad|Tablet/.test(ua)) deviceType = "tablet";
  else if (/Mobi|Android|iPhone|iPod/.test(ua)) deviceType = "mobile";

  const label = browser === "Inconnu" ? "Appareil inconnu" : `${browser} sur ${os}`;

  return { browser, os, deviceType, label };
}

// Fingerprint stable pour trusted devices (hash SHA-256 cote serveur)
export async function deviceFingerprint(ua: string, ip: string | null): Promise<string> {
  const enc = new TextEncoder().encode(`${ua}|${ip ?? "noip"}`);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
