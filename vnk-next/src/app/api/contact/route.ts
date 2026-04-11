// POST /api/contact — formulaire public (avec rate limiting + honeypot)
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const contactSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email(),
  company: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  service: z.string().max(100).optional(),
  plcBrand: z.string().max(100).optional(),
  message: z.string().min(10).max(5000),
  // Honeypot : si ce champ est rempli, on bloque silencieusement
  website: z.string().optional(),
});

// Rate limit simple in-memory (production : utiliser Redis)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5; // 5 soumissions par heure
const WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0] ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Trop de soumissions. Réessayez dans une heure." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Honeypot : silent block
  if (parsed.data.website) {
    // Fake success pour pas alerter le bot
    return NextResponse.json({ success: true });
  }

  await prisma.contactMessage.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      company: parsed.data.company,
      phone: parsed.data.phone,
      service: parsed.data.service,
      plcBrand: parsed.data.plcBrand,
      message: parsed.data.message,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    },
  });

  // TODO: notifier admin via email + WebSocket
  // TODO: auto-create client account si email n'existe pas

  return NextResponse.json({ success: true });
}
