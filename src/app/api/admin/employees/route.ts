// GET /api/admin/employees?limit=200
// Liste compacte des employes actifs pour les selects/previews
// (TemplateWizard, ContractWizard, etc.). Pas de pagination complete,
// just un cap raisonnable. Auth : admin authentifie.
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limitRaw = Number(searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(limitRaw) && limitRaw > 0
    ? Math.min(limitRaw, 500)
    : 200;

  const rows = await prisma.admin.findMany({
    where: { isActive: true },
    orderBy: { fullName: "asc" },
    take: limit,
    select: {
      id: true,
      fullName: true,
      email: true,
      department: true,
      avatarUrl: true,
      position: { select: { name: true } },
    },
  });

  const items = rows.map((r) => ({
    id: r.id,
    fullName: r.fullName ?? r.email ?? null,
    position: r.position?.name ?? null,
    department: r.department ?? null,
    avatarUrl: r.avatarUrl ?? null,
  }));

  return NextResponse.json({ items });
}
