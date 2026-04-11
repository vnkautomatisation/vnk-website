// GET /api/documents — liste documents (admin: tous, client: les siens)
// POST /api/documents — upload (admin)
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const createSchema = z.object({
  clientId: z.number().int().positive(),
  mandateId: z.number().int().positive().optional(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  fileType: z.string().optional(),
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
  fileSize: z.number().int().optional(),
  category: z.string().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const unread = searchParams.get("unread") === "true";

  const documents = await prisma.document.findMany({
    where: {
      ...(session.user.role === "admin"
        ? {}
        : { clientId: session.user.clientId! }),
      ...(category && { category }),
      ...(unread && { isRead: false }),
    },
    include: {
      mandate: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ documents });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const document = await prisma.document.create({
    data: {
      ...parsed.data,
      uploadedBy: session.user.email ?? "admin",
    },
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "create",
    entityType: "documents",
    entityId: document.id,
  });

  return NextResponse.json({ success: true, document });
}
