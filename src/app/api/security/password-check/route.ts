// API · Verification HIBP en temps reel (debounce cote client)
import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { checkPasswordBreached, passwordStrength } from "@/lib/security/hibp";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export async function POST(request: NextRequest) {
  const t = await getTranslations("api_errors");
  const session = await auth();
  if (!session?.user) {
    return unauthorizedJson();
  }

  try {
    const { password } = await request.json();
    if (typeof password !== "string" || password.length < 1) {
      return NextResponse.json({ error: t("mot_de_passe_requis") }, { status: 400 });
    }

    const [breach, strength] = await Promise.all([
      checkPasswordBreached(password),
      Promise.resolve(passwordStrength(password)),
    ]);

    return NextResponse.json({
      breached: breach.breached,
      breachCount: breach.count,
      strength: strength.score,
      strengthLabel: strength.label,
    });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
