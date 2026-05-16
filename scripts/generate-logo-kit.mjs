// Logo kit VNK Automatisation Inc.
// Genere tous les SVG / PNG / ICO a partir du design canonique de public-nav.tsx
//   - badge carre arrondi (rounded-lg, bg-white/10, border-white/20)
//   - texte "VNK" blanc
//   - wordmark "Automatisation Inc."
//   - tagline "VALUE . NETWORK . KNOWLEDGE"
//
// Usage : node scripts/generate-logo-kit.mjs

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url)) + '/..';
const LOGO_DIR = join(ROOT, 'public', 'logo');
const FAVICON_DIR = join(ROOT, 'public', 'favicon');
const IMAGES_DIR = join(ROOT, 'public', 'images');

// ─── Brand tokens (verifies dans le code) ──────────────────────────
const NAVY = '#0F2D52';        // bg header public, theme color
const NAVY_DEEP = '#0A1F3A';   // mobile drawer
const BLUE = '#1B4F8A';        // PDF brand, manifest theme
const BG_LIGHT = '#EBF2FA';    // light accent
const GRAY = '#64748B';        // tagline gray sur light
const FONT_STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

// ─── SVG templates ─────────────────────────────────────────────────
// Logo horizontal : viewBox 520x100
// Badge 80x80 a (10,10), rx=14 ≈ Tailwind rounded-lg
// Wordmark x=108, y=50 ; Tagline x=109, y=72

function svgHorizontal({ badgeFill, badgeStroke, badgeStrokeWidth, badgeText, wordFill, tagFill, tagOpacity = 1 }) {
  const stroke = badgeStroke
    ? `stroke="${badgeStroke}" stroke-width="${badgeStrokeWidth || 1.5}"`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 100" role="img" aria-label="VNK Automatisation Inc.">
  <title>VNK Automatisation Inc.</title>
  <rect x="10" y="10" width="80" height="80" rx="14" fill="${badgeFill}" ${stroke}/>
  <text x="50" y="60" text-anchor="middle" font-size="24" font-weight="800" fill="${badgeText}" font-family="${FONT_STACK}" letter-spacing="0.5">VNK</text>
  <text x="108" y="50" font-size="28" font-weight="700" fill="${wordFill}" font-family="${FONT_STACK}">Automatisation Inc.</text>
  <text x="109" y="74" font-size="11" font-weight="500" fill="${tagFill}" font-family="${FONT_STACK}" letter-spacing="2.5" fill-opacity="${tagOpacity}">VALUE &#xB7; NETWORK &#xB7; KNOWLEDGE</text>
</svg>
`;
}

function svgHorizontalAnimated() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 100" role="img" aria-label="VNK Automatisation Inc.">
  <title>VNK Automatisation Inc.</title>
  <rect x="10" y="10" width="80" height="80" rx="14" fill="${NAVY}">
    <animate attributeName="fill-opacity" values="1;0.78;1" dur="2.8s" repeatCount="indefinite"/>
  </rect>
  <text x="50" y="60" text-anchor="middle" font-size="24" font-weight="800" fill="#FFFFFF" font-family="${FONT_STACK}" letter-spacing="0.5">VNK</text>
  <text x="108" y="50" font-size="28" font-weight="700" fill="${NAVY}" font-family="${FONT_STACK}">Automatisation Inc.</text>
  <text x="109" y="74" font-size="11" font-weight="500" fill="${GRAY}" font-family="${FONT_STACK}" letter-spacing="2.5">VALUE &#xB7; NETWORK &#xB7; KNOWLEDGE</text>
</svg>
`;
}

// Mark / icone seule : viewBox 200x200 ; badge plein viewBox (rx=44 ≈ Apple)
function svgMark({ bgFill, badgeFill, badgeStroke, badgeStrokeWidth, textFill, hasBg = true }) {
  const bg = hasBg ? `<rect width="200" height="200" rx="44" fill="${bgFill}"/>` : '';
  const stroke = badgeStroke
    ? `stroke="${badgeStroke}" stroke-width="${badgeStrokeWidth || 6}"`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="VNK">
  <title>VNK</title>
  ${bg}
  <rect x="24" y="24" width="152" height="152" rx="28" fill="${badgeFill}" ${stroke}/>
  <text x="100" y="124" text-anchor="middle" font-size="56" font-weight="800" fill="${textFill}" font-family="${FONT_STACK}" letter-spacing="2">VNK</text>
</svg>
`;
}

// Favicon optimise 64x64 : pas de double-badge (un seul carre brand, juste "VNK")
function svgFavicon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="VNK">
  <title>VNK</title>
  <rect width="64" height="64" rx="12" fill="${NAVY}"/>
  <text x="32" y="42" text-anchor="middle" font-size="22" font-weight="800" fill="#FFFFFF" font-family="${FONT_STACK}" letter-spacing="1">VNK</text>
</svg>
`;
}

// ─── Definitions des variantes SVG ─────────────────────────────────
const SVG_FILES = {
  // Logo horizontal
  'vnk-logo-horizontal-light.svg': svgHorizontal({
    badgeFill: NAVY,
    badgeText: '#FFFFFF',
    wordFill: NAVY,
    tagFill: GRAY,
  }),
  'vnk-logo-horizontal-dark.svg': svgHorizontal({
    badgeFill: 'rgba(255,255,255,0.10)',
    badgeStroke: 'rgba(255,255,255,0.20)',
    badgeText: '#FFFFFF',
    wordFill: '#FFFFFF',
    tagFill: '#FFFFFF',
    tagOpacity: 0.60,
  }),
  'vnk-logo-horizontal-mono-black.svg': svgHorizontal({
    badgeFill: 'rgba(0,0,0,0.08)',
    badgeStroke: '#000000',
    badgeStrokeWidth: 1.5,
    badgeText: '#000000',
    wordFill: '#000000',
    tagFill: '#000000',
    tagOpacity: 0.65,
  }),
  'vnk-logo-horizontal-mono-white.svg': svgHorizontal({
    badgeFill: 'rgba(255,255,255,0.10)',
    badgeStroke: '#FFFFFF',
    badgeStrokeWidth: 1.5,
    badgeText: '#FFFFFF',
    wordFill: '#FFFFFF',
    tagFill: '#FFFFFF',
    tagOpacity: 0.70,
  }),
  'vnk-logo-horizontal-animated.svg': svgHorizontalAnimated(),

  // Mark / icone
  'vnk-mark-color.svg': svgMark({
    bgFill: NAVY,
    badgeFill: 'rgba(255,255,255,0.10)',
    badgeStroke: 'rgba(255,255,255,0.30)',
    textFill: '#FFFFFF',
  }),
  'vnk-mark-transparent-dark.svg': svgMark({
    hasBg: false,
    badgeFill: 'rgba(255,255,255,0.10)',
    badgeStroke: 'rgba(255,255,255,0.30)',
    textFill: '#FFFFFF',
  }),
  'vnk-mark-transparent-light.svg': svgMark({
    hasBg: false,
    badgeFill: NAVY,
    textFill: '#FFFFFF',
  }),
  'vnk-mark-mono-black.svg': svgMark({
    hasBg: false,
    badgeFill: 'none',
    badgeStroke: '#000000',
    textFill: '#000000',
  }),
  'vnk-mark-mono-white.svg': svgMark({
    hasBg: false,
    badgeFill: 'none',
    badgeStroke: '#FFFFFF',
    textFill: '#FFFFFF',
  }),

  // Favicon optimise
  'vnk-favicon.svg': svgFavicon(),
};

// ─── Definitions des exports PNG ───────────────────────────────────
const PNG_TASKS = [
  // Favicons (carre, fond navy plein)
  { src: 'vnk-favicon.svg', out: 'vnk-favicon-16.png', size: 16 },
  { src: 'vnk-favicon.svg', out: 'vnk-favicon-32.png', size: 32 },
  { src: 'vnk-favicon.svg', out: 'vnk-favicon-48.png', size: 48 },
  { src: 'vnk-favicon.svg', out: 'vnk-favicon-96.png', size: 96 },
  { src: 'vnk-favicon.svg', out: 'vnk-favicon-180.png', size: 180 },  // Apple touch
  { src: 'vnk-favicon.svg', out: 'vnk-favicon-192.png', size: 192 },  // Android / PWA
  { src: 'vnk-favicon.svg', out: 'vnk-favicon-512.png', size: 512 },  // PWA
  { src: 'vnk-favicon.svg', out: 'vnk-favicon-1024.png', size: 1024 }, // App store

  // Mark color (carre fond navy)
  { src: 'vnk-mark-color.svg', out: 'vnk-mark-color-64.png', size: 64 },
  { src: 'vnk-mark-color.svg', out: 'vnk-mark-color-128.png', size: 128 },
  { src: 'vnk-mark-color.svg', out: 'vnk-mark-color-256.png', size: 256 },
  { src: 'vnk-mark-color.svg', out: 'vnk-mark-color-512.png', size: 512 },
  { src: 'vnk-mark-color.svg', out: 'vnk-mark-color-1024.png', size: 1024 },

  // Mark transparent (fond transparent)
  { src: 'vnk-mark-transparent-dark.svg', out: 'vnk-mark-transparent-dark-256.png', size: 256 },
  { src: 'vnk-mark-transparent-dark.svg', out: 'vnk-mark-transparent-dark-512.png', size: 512 },
  { src: 'vnk-mark-transparent-light.svg', out: 'vnk-mark-transparent-light-256.png', size: 256 },
  { src: 'vnk-mark-transparent-light.svg', out: 'vnk-mark-transparent-light-512.png', size: 512 },

  // Mark mono
  { src: 'vnk-mark-mono-black.svg', out: 'vnk-mark-mono-black-256.png', size: 256 },
  { src: 'vnk-mark-mono-black.svg', out: 'vnk-mark-mono-black-512.png', size: 512 },
  { src: 'vnk-mark-mono-white.svg', out: 'vnk-mark-mono-white-256.png', size: 256, bg: NAVY_DEEP },
  { src: 'vnk-mark-mono-white.svg', out: 'vnk-mark-mono-white-512.png', size: 512, bg: NAVY_DEEP },

  // Logo horizontal (rectangulaire, ratio 520:100)
  { src: 'vnk-logo-horizontal-light.svg', out: 'vnk-logo-light-600.png', w: 600 },
  { src: 'vnk-logo-horizontal-light.svg', out: 'vnk-logo-light-1200.png', w: 1200 },
  { src: 'vnk-logo-horizontal-light.svg', out: 'vnk-logo-light-1920.png', w: 1920 },
  { src: 'vnk-logo-horizontal-dark.svg', out: 'vnk-logo-dark-600.png', w: 600, bg: NAVY },
  { src: 'vnk-logo-horizontal-dark.svg', out: 'vnk-logo-dark-1200.png', w: 1200, bg: NAVY },
  { src: 'vnk-logo-horizontal-dark.svg', out: 'vnk-logo-dark-1920.png', w: 1920, bg: NAVY },
  { src: 'vnk-logo-horizontal-dark.svg', out: 'vnk-logo-dark-transparent-1200.png', w: 1200 },
  { src: 'vnk-logo-horizontal-mono-black.svg', out: 'vnk-logo-mono-black-600.png', w: 600 },
  { src: 'vnk-logo-horizontal-mono-black.svg', out: 'vnk-logo-mono-black-1200.png', w: 1200 },
  { src: 'vnk-logo-horizontal-mono-white.svg', out: 'vnk-logo-mono-white-600.png', w: 600, bg: '#000000' },
  { src: 'vnk-logo-horizontal-mono-white.svg', out: 'vnk-logo-mono-white-1200.png', w: 1200, bg: '#000000' },

  // PWA maskable (padding 20% safe zone)
  { src: 'vnk-favicon.svg', out: 'vnk-maskable-192.png', size: 192, padding: 0.2, bg: NAVY },
  { src: 'vnk-favicon.svg', out: 'vnk-maskable-512.png', size: 512, padding: 0.2, bg: NAVY },

  // OpenGraph / Twitter (1200x630 et 1200x600)
  { src: 'vnk-logo-horizontal-dark.svg', out: 'vnk-og-1200x630.png', custom: { w: 1200, h: 630, bg: NAVY } },
  { src: 'vnk-logo-horizontal-dark.svg', out: 'vnk-twitter-1200x600.png', custom: { w: 1200, h: 600, bg: NAVY } },
];

// ─── Cibles existantes a regenerer (referenees par layout.tsx) ─────
const FAVICON_TARGETS = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-48x48.png', size: 48 },
  { name: 'favicon-180x180.png', size: 180 },
  { name: 'favicon-192x192.png', size: 192 },
  { name: 'favicon-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'android-chrome-192x192.png', size: 192 },
  { name: 'android-chrome-512x512.png', size: 512 },
];

// ─── ICO encoder minimal (multi-tailles 16/32/48) ──────────────────
function buildIco(pngBuffers) {
  // ICONDIR : 6 octets
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);        // reserved
  header.writeUInt16LE(1, 2);        // type = ICO
  header.writeUInt16LE(count, 4);    // count

  // Entrees + offsets
  const entrySize = 16;
  const entriesBuf = Buffer.alloc(count * entrySize);
  let offset = 6 + count * entrySize;
  pngBuffers.forEach(({ buf, size }, i) => {
    const off = i * entrySize;
    entriesBuf.writeUInt8(size === 256 ? 0 : size, off + 0);     // width
    entriesBuf.writeUInt8(size === 256 ? 0 : size, off + 1);     // height
    entriesBuf.writeUInt8(0, off + 2);                            // color count
    entriesBuf.writeUInt8(0, off + 3);                            // reserved
    entriesBuf.writeUInt16LE(1, off + 4);                         // color planes
    entriesBuf.writeUInt16LE(32, off + 6);                        // bpp
    entriesBuf.writeUInt32LE(buf.length, off + 8);                // size in bytes
    entriesBuf.writeUInt32LE(offset, off + 12);                   // offset
    offset += buf.length;
  });

  return Buffer.concat([header, entriesBuf, ...pngBuffers.map(p => p.buf)]);
}

// ─── Helpers ───────────────────────────────────────────────────────
async function renderPng(svg, { size, w, h, bg, padding = 0, custom }) {
  if (custom) {
    // Aspect libre : SVG ajuste dans une boite, fond couleur (OG card)
    const inner = await sharp(Buffer.from(svg))
      .resize(Math.round(custom.w * 0.82), Math.round(custom.h * 0.82), { fit: 'inside' })
      .png()
      .toBuffer();
    return sharp({
      create: {
        width: custom.w,
        height: custom.h,
        channels: 4,
        background: custom.bg ?? { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: inner, gravity: 'center' }])
      .png()
      .toBuffer();
  }

  // Largeur seule (logo horizontal) : hauteur calculee depuis le ratio du SVG
  if (w && !h && !size) {
    const innerW = padding ? Math.round(w * (1 - padding * 2)) : w;
    const inner = await sharp(Buffer.from(svg))
      .resize({ width: innerW })
      .png()
      .toBuffer();
    const meta = await sharp(inner).metadata();
    const innerH = meta.height;
    const targetH = padding ? Math.round(innerH / (1 - padding * 2)) : innerH;
    if (!padding && !bg) return inner;
    return sharp({
      create: {
        width: w,
        height: targetH,
        channels: 4,
        background: bg ?? { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: inner, gravity: 'center' }])
      .png()
      .toBuffer();
  }

  const targetW = w || size;
  const targetH = h || size;
  const innerW = padding ? Math.round(targetW * (1 - padding * 2)) : targetW;
  const innerH = padding ? Math.round(targetH * (1 - padding * 2)) : targetH;

  const inner = await sharp(Buffer.from(svg))
    .resize(innerW, innerH, { fit: 'inside' })
    .png()
    .toBuffer();

  if (!padding && !bg) {
    return inner;
  }

  return sharp({
    create: {
      width: targetW,
      height: targetH,
      channels: 4,
      background: bg ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: inner, gravity: 'center' }])
    .png()
    .toBuffer();
}

// ─── Main ──────────────────────────────────────────────────────────
async function main() {
  await mkdir(LOGO_DIR, { recursive: true });
  await mkdir(FAVICON_DIR, { recursive: true });

  // 1) Ecrire les SVG dans /public/logo/
  console.log('SVG (' + Object.keys(SVG_FILES).length + ')');
  for (const [name, content] of Object.entries(SVG_FILES)) {
    await writeFile(join(LOGO_DIR, name), content, 'utf8');
    console.log('  ' + name);
  }

  // 2) Generer les PNG dans /public/logo/
  console.log('\nPNG (' + PNG_TASKS.length + ')');
  const svgCache = {};
  for (const task of PNG_TASKS) {
    if (!svgCache[task.src]) {
      svgCache[task.src] = SVG_FILES[task.src];
      if (!svgCache[task.src]) throw new Error('SVG source manquant : ' + task.src);
    }
    const png = await renderPng(svgCache[task.src], task);
    await writeFile(join(LOGO_DIR, task.out), png);
    console.log('  ' + task.out);
  }

  // 3) Generer favicon.ico (16, 32, 48) dans /public/logo/
  console.log('\nICO');
  const icoSizes = [16, 32, 48];
  const icoBufs = [];
  for (const size of icoSizes) {
    const buf = await renderPng(SVG_FILES['vnk-favicon.svg'], { size });
    icoBufs.push({ buf, size });
  }
  const icoBytes = buildIco(icoBufs);
  await writeFile(join(LOGO_DIR, 'vnk-favicon.ico'), icoBytes);
  await writeFile(join(LOGO_DIR, 'favicon.ico'), icoBytes); // alias standard
  console.log('  vnk-favicon.ico + favicon.ico');

  // 4) Regenerer /public/favicon/ (referenes par layout.tsx)
  console.log('\nFavicons (legacy /public/favicon/)');
  for (const t of FAVICON_TARGETS) {
    const png = await renderPng(SVG_FILES['vnk-favicon.svg'], { size: t.size });
    await writeFile(join(FAVICON_DIR, t.name), png);
    console.log('  ' + t.name);
  }
  await writeFile(join(FAVICON_DIR, 'favicon.ico'), icoBytes);
  console.log('  favicon.ico');

  // 5) Regenerer la twitter card existante (referenee par layout.tsx)
  console.log('\nOG legacy');
  const ogPng = await renderPng(SVG_FILES['vnk-logo-horizontal-dark.svg'], {
    custom: { w: 1200, h: 600, bg: NAVY },
  });
  await writeFile(join(IMAGES_DIR, 'vnk-twitter-card-1200x600.png'), ogPng);
  console.log('  vnk-twitter-card-1200x600.png');

  console.log('\nOK.');
}

main().catch(e => { console.error(e); process.exit(1); });
