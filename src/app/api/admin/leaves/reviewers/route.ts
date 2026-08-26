// GET /api/admin/leaves/reviewers
// Liste des admins éligibles comme délégué d'approbation (super_admin OU permissions
// users/leaves:write). Utilisé par la modal de délégation côté employé reviewer.
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
  const adminId = session.user.adminId!;
  const candidates = await prisma.admin.findMany({
    where: { isActive: true, id: { not: adminId } },
    select: {
      id: true,
      fullName: true,
      email: true,
      customRole: { select: { name: true, permissions: true } },
    },
    orderBy: { fullName: "asc" },
  });
  const employees = candidates
    .filter((c) => {
      const perms = (c.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
      const isSuper = c.customRole?.name === "super_admin";
      return isSuper || (perms.leaves ?? []).includes("write") || (perms.users ?? []).includes("write");
    })
    .map(({ id, fullName, email }) => ({ id, fullName, email }));
  return NextResponse.json({ employees });
}
