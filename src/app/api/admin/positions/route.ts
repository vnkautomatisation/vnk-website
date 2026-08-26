// GET /api/admin/positions
// Liste tous les postes pour les pickers admin (ContractWizard, TemplateWizard).
// Tri : isSystem desc, sortOrder asc, name asc.
// Auth : admin uniquement.
import "server-only";
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

  const positions = await prisma.position.findMany({
    orderBy: [{ isSystem: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      defaultDepartment: true,
      color: true,
      isSystem: true,
    },
  });

  return NextResponse.json({ items: positions });
}
