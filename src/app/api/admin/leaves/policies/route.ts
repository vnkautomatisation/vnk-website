// GET /api/admin/leaves/policies
// Liste minimale des politiques de congés pour les sélecteurs UI.
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const policies = await prisma.leavePolicy.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true, name: true, isDefault: true },
  });
  return NextResponse.json({ policies });
}
