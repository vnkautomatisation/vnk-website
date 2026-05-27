// GET /api/admin/document-templates/starters?type=legal|contract|policy
// Retourne la liste des templates "starter" (isStarter = true) pour le type
// demande. Permet a la bibliotheque du wizard d'afficher des modeles
// pre-remplis livres avec l'app.
//
// Reponse : { items: StarterTemplate[] }
//
// Auth : admin uniquement (session NextAuth).
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["legal", "contract", "policy"] as const;
type StarterType = (typeof ALLOWED_TYPES)[number];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as StarterType | null;
  if (!type || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.json(
      { error: "Parametre 'type' invalide (legal | contract | policy)" },
      { status: 400 },
    );
  }

  try {
    if (type === "legal") {
      const rows = await prisma.legalDocumentTemplate.findMany({
        where: { isStarter: true, isActive: true },
        orderBy: [{ category: "asc" }, { title: "asc" }],
        select: {
          id: true,
          key: true,
          title: true,
          category: true,
          version: true,
          bodyMarkdown: true,
          targetPositions: true,
          targetDepartments: true,
        },
      });
      return NextResponse.json({
        items: rows.map((r) => ({
          id: r.id,
          key: r.key,
          name: r.title,
          category: r.category,
          version: r.version,
          bodyMarkdown: r.bodyMarkdown,
          targetPositions: r.targetPositions ?? [],
          targetDepartments: r.targetDepartments ?? [],
        })),
      });
    }

    if (type === "contract") {
      const rows = await prisma.contractTemplate.findMany({
        where: { isStarter: true, isActive: true },
        orderBy: [{ contractType: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          contractType: true,
          bodyMarkdown: true,
          targetPositions: true,
          targetDepartments: true,
        },
      });
      return NextResponse.json({
        items: rows.map((r) => ({
          id: r.id,
          name: r.name,
          category: r.contractType,
          bodyMarkdown: r.bodyMarkdown,
          targetPositions: r.targetPositions ?? [],
          targetDepartments: r.targetDepartments ?? [],
        })),
      });
    }

    // type === "policy"
    const rows = await prisma.hrPolicy.findMany({
      where: { isStarter: true, isActive: true },
      orderBy: [{ title: "asc" }],
      select: {
        id: true,
        key: true,
        title: true,
        version: true,
        bodyMarkdown: true,
      },
    });
    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.title,
        version: r.version,
        bodyMarkdown: r.bodyMarkdown,
        targetPositions: [],
        targetDepartments: [],
      })),
    });
  } catch (err) {
    console.error("[document-templates/starters]", err);
    return NextResponse.json(
      { error: "Erreur lors de la lecture de la bibliotheque" },
      { status: 500 },
    );
  }
}
