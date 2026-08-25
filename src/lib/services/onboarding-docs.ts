// ─────────────────────────────────────────────────────────
// Auto-assignation des documents requis a un NOUVEL employe.
// Appele a la creation du compte (users.ts) et a l'acceptation d'une
// invitation (invitations.ts) : cree une DocumentSignatureRequest
// individuelle pour chaque template legal actif + requis qui n'est pas
// couvert par un cahier actif (les cahiers apparaissent d'eux-memes,
// pilotes par version) + une notification de bienvenue.
// Best-effort : ne bloque JAMAIS la creation du compte.
// ─────────────────────────────────────────────────────────
import "server-only";
import { prisma } from "@/lib/prisma";

export async function assignRequiredDocsToNewEmployee(
  newAdminId: number,
  requestedById?: number | null,
): Promise<{ created: number }> {
  try {
    const [templates, handbooks, existingPending, existingSignatures] = await Promise.all([
      prisma.legalDocumentTemplate.findMany({
        where: { isActive: true, isRequired: true, isStarter: false },
        select: { id: true, title: true, version: true },
      }),
      prisma.documentHandbook.findMany({
        where: { isActive: true },
        select: { items: { select: { templateId: true } } },
      }),
      prisma.documentSignatureRequest.findMany({
        where: { targetAdminId: newAdminId, status: "pending" },
        select: { templateId: true },
      }),
      prisma.legalDocumentSignature.findMany({
        where: { adminId: newAdminId },
        select: { templateId: true, version: true },
      }),
    ]);

    const inHandbook = new Set(handbooks.flatMap((h) => h.items.map((i) => i.templateId)));
    const pendingSet = new Set(existingPending.map((r) => r.templateId));
    const signedSet = new Set(existingSignatures.map((s) => `${s.templateId}-${s.version}`));

    const toAssign = templates.filter(
      (t) =>
        !inHandbook.has(t.id)
        && !pendingSet.has(t.id)
        && !signedSet.has(`${t.id}-${t.version}`),
    );
    if (toAssign.length === 0) return { created: 0 };

    // requestedById obligatoire sur la DSR : fallback = premier super_admin.
    let requesterId = requestedById ?? null;
    if (!requesterId) {
      const superAdmin = await prisma.admin.findFirst({
        where: { customRole: { name: "super_admin" }, isActive: true },
        orderBy: { id: "asc" },
        select: { id: true },
      });
      requesterId = superAdmin?.id ?? newAdminId;
    }

    await prisma.documentSignatureRequest.createMany({
      data: toAssign.map((t) => ({
        templateId: t.id,
        requestedById: requesterId as number,
        targetAdminId: newAdminId,
        reason: "Documents d'embauche — a signer pour completer votre dossier",
        status: "pending",
      })),
    });

    await prisma.notification.create({
      data: {
        recipientType: "admin",
        recipientId: newAdminId,
        type: "info",
        title: "Documents d'embauche à signer",
        body: `${toAssign.length} document(s) requis vous attendent dans Mon espace → Documents.`,
        link: "/admin/mon-espace/documents",
        icon: "file-signature",
      },
    }).catch(() => null);

    return { created: toAssign.length };
  } catch (e) {
    console.error("[assignRequiredDocsToNewEmployee] Echec (non bloquant) :", e);
    return { created: 0 };
  }
}
