// API · Web Push — enregistrer/supprimer un abonnement.
// La clé publique VAPID est exposée pour que le client puisse s'abonner.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { adminApiForbiddenAll } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";

export async function GET() {
  return NextResponse.json({
    vapidPublicKey: VAPID_PUBLIC_KEY,
    enabled: !!VAPID_PUBLIC_KEY,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbiddenAll([["settings", "write"]])) {
    return forbiddenJson();
  }
  const adminId = session.user.adminId!;

  try {
    const body = await req.json();
    const { endpoint, keys, label } = body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Subscription incomplète" }, { status: 400 });
    }

    const userAgent = req.headers.get("user-agent") ?? null;

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { authKey: keys.auth, p256dh: keys.p256dh, label: label ?? null, userAgent },
      create: {
        adminId,
        endpoint,
        p256dh: keys.p256dh,
        authKey: keys.auth,
        label: label ?? null,
        userAgent,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[push-subscribe]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbiddenAll([["settings", "write"]])) {
    return forbiddenJson();
  }
  const url = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint");
  if (!endpoint) return NextResponse.json({ error: "endpoint requis" }, { status: 400 });

  await prisma.pushSubscription.deleteMany({
    where: { endpoint, adminId: session.user.adminId! },
  });

  return NextResponse.json({ ok: true });
}
