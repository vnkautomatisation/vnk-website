// GET /api/admin/document-upload-requests
// Liste les demandes pour le panneau admin avec filtres :
//   ?status=pending|uploaded|approved|rejected|cancelled|all (default: pending,uploaded)
//   ?employeeId=<id>
//   ?search=<terme>
// Auth : RH (users.write|hr.write|super_admin) OU manager direct (uniquement
// pour ses propres directReports).
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const actorId = session.user.adminId!;

  const me = await prisma.admin.findUnique({
    where: { id: actorId },
    include: { customRole: true },
  });
  if (!me) return unauthorizedJson();

  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = me.customRole?.name === "super_admin";
  const isHr =
    isSuper
    || (perms.users ?? []).includes("read")
    || (perms.users ?? []).includes("write")
    || (perms.hr ?? []).includes("read")
    || (perms.hr ?? []).includes("write");

  // Filtres
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") || "open";
  const employeeIdParam = url.searchParams.get("employeeId");
  const search = (url.searchParams.get("search") || "").trim();

  type WhereStatus =
    | { status: { in: string[] } }
    | { status: string }
    | Record<string, never>;
  let statusWhere: WhereStatus = {};
  if (statusParam === "all") {
    statusWhere = {};
  } else if (statusParam === "open") {
    statusWhere = { status: { in: ["pending", "uploaded"] } };
  } else if (
    ["pending", "uploaded", "approved", "rejected", "cancelled"].includes(
      statusParam,
    )
  ) {
    statusWhere = { status: statusParam };
  }

  // Manager non-RH : restreindre à ses directReports
  let targetIdsFilter: number[] | null = null;
  if (!isHr) {
    const reports = await prisma.admin.findMany({
      where: { managerId: actorId, isActive: true },
      select: { id: true },
    });
    targetIdsFilter = reports.map((r) => r.id);
    if (targetIdsFilter.length === 0) {
      return NextResponse.json({ requests: [] });
    }
  }

  const rows = await prisma.documentUploadRequest.findMany({
    where: {
      ...statusWhere,
      ...(employeeIdParam ? { targetAdminId: Number(employeeIdParam) } : {}),
      ...(targetIdsFilter ? { targetAdminId: { in: targetIdsFilter } } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              {
                targetAdmin: {
                  OR: [
                    { fullName: { contains: search, mode: "insensitive" } },
                    { email: { contains: search, mode: "insensitive" } },
                  ],
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      targetAdmin: { select: { id: true, fullName: true, email: true } },
      requestedBy: { select: { id: true, fullName: true, email: true } },
      reviewedBy: { select: { id: true, fullName: true, email: true } },
    },
  });

  return NextResponse.json({ requests: rows });
}
