import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { MyDocumentsView } from "./my-documents-view";

export const metadata: Metadata = { title: "Mon espace - Documents" };
export const dynamic = "force-dynamic";

export default async function MyDocumentsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const me = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { id: true, teamId: true, fullName: true, email: true },
  });
  if (!me) redirect("/admin/login");

  // Bug fix : ne PAS afficher tous les LegalDocumentTemplate `isRequired:true`
  // (les starters bibliotheque y seraient automatiquement -> ~59 docs faussement
  // "obligatoires"). On ne montre QUE les templates pour lesquels une
  // DocumentSignatureRequest cible cet employe (individuel / equipe / tous).
  // Ces requests sont fetchees plus bas (signatureRequests) -> on extrait
  // ensuite les templates uniques associes pour le rendu "A signer".
  const [
    mySignatures,
    taxDocs,
    payStubs,
    contracts,
    letterRequests,
    personalDocs,
    signatureRequests,
    pendingUploadRequests,
    activeHandbooks,
    myHandbookSignatures,
  ] = await Promise.all([
    // Fix : on inclut le titre + key du template pour pouvoir afficher
    // dans le tab "Signes" meme si le template a ete archive/desactive
    // (auquel cas il n'est plus dans legalDocs).
    prisma.legalDocumentSignature.findMany({
      where: { adminId },
      select: {
        id: true,
        templateId: true,
        version: true,
        signedAt: true,
        finalPdfUrl: true,
        template: { select: { title: true, key: true, category: true } },
      },
    }),
    prisma.taxDocument.findMany({
      where: { adminId },
      orderBy: [{ taxYear: "desc" }, { issuedAt: "desc" }],
      include: { issuer: { select: { id: true, fullName: true, email: true } } },
    }),
    prisma.payStub.findMany({
      where: { adminId, releasedAt: { not: null } },
      orderBy: { releasedAt: "desc" },
      take: 24,
      include: { period: { select: { id: true, startDate: true, endDate: true } } },
    }),
    prisma.employeeContract.findMany({
      where: { adminId },
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        title: true,
        contractType: true,
        startDate: true,
        endDate: true,
        status: true,
        pdfUrl: true,
        employeeSignedAt: true,
        employerSignedAt: true,
        createdAt: true,
      },
    }),
    prisma.employmentLetterRequest.findMany({
      where: { adminId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.employeePersonalDocument.findMany({
      where: { adminId },
      orderBy: [{ category: "asc" }, { createdAt: "desc" }],
      include: { verifiedBy: { select: { id: true, fullName: true, email: true } } },
    }),
    prisma.documentSignatureRequest.findMany({
      where: {
        status: "pending",
        completedAt: null,
        OR: [
          { targetAdminId: adminId },
          ...(me.teamId ? [{ targetTeamId: me.teamId }] : []),
          { targetAll: true },
        ],
      },
      orderBy: [{ dueDate: "asc" }, { requestedAt: "desc" }],
      include: {
        template: {
          // ⚠ acknowledgmentMode est ajoute via cast plus bas car le client
          // Prisma genere peut ne pas encore connaitre le champ (dev server
          // pas redemarre apres `prisma db push`). On demande TOUT pour
          // garantir la propagation.
          select: {
            id: true,
            key: true,
            title: true,
            category: true,
            version: true,
            bodyMarkdown: true,
            isRequired: true,
            isActive: true,
            signatureScope: true,
            ...({ acknowledgmentMode: true } as object),
          },
        },
        requestedBy: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.documentUploadRequest.findMany({
      where: { targetAdminId: adminId, status: "pending" },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        requestedBy: { select: { id: true, fullName: true, email: true } },
      },
    }),
    // Cahiers actifs (= handbooks publies, dont l'employe doit potentiellement
    // signer la version courante). On charge tous les actifs : le filtrage
    // "deja signe / pas encore signe" se fait cote vue.
    prisma.documentHandbook.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
      include: {
        items: {
          orderBy: { orderIndex: "asc" },
          include: {
            template: {
              select: {
                id: true,
                title: true,
                version: true,
                bodyMarkdown: true,
              },
            },
          },
        },
      },
    }),
    // Mes signatures de cahier (toutes versions, pour comparer).
    // On inclut le titre du handbook pour affichage dans tab "Signes" meme
    // si le handbook est archive/desactive plus tard.
    prisma.documentHandbookSignature.findMany({
      where: { adminId },
      select: {
        id: true,
        handbookId: true,
        version: true,
        signedAt: true,
        finalPdfUrl: true,
        handbook: { select: { title: true, key: true } },
      },
    }),
  ]);

  // Bug fix : on derive la liste "legalDocs" UNIQUEMENT a partir des templates
  // cibles par une signature request active de cet employe (et dont le template
  // est encore actif). Plus de starters bibliotheque listes automatiquement.
  //
  // Map cle->signature la plus recente pour ce template (avec date) pour
  // determiner si la demande est posterieure (= re-signing requis).
  const latestSignatureByTemplate = new Map<
    number,
    { version: string; signedAt: Date }
  >();
  for (const s of mySignatures) {
    const cur = latestSignatureByTemplate.get(s.templateId);
    const at = new Date(s.signedAt);
    if (!cur || at > cur.signedAt) {
      latestSignatureByTemplate.set(s.templateId, { version: s.version, signedAt: at });
    }
  }

  // Templates couverts par un cahier que l'employe a deja signe (version
  // courante du cahier). On les exclut de "a signer" individuellement.
  const signedHandbookKey = new Map(
    myHandbookSignatures.map((s) => [s.handbookId, s.version] as const),
  );
  const templatesCoveredByHandbook = new Set<number>();
  for (const hb of activeHandbooks) {
    if (signedHandbookKey.get(hb.id) === hb.version) {
      for (const it of hb.items) templatesCoveredByHandbook.add(it.templateId);
    }
  }

  const legalDocs = signatureRequests
    .filter((r) => r.template.isActive)
    // Inclut le template si :
    //   - pas de signature -> oui
    //   - signature sur une version differente -> oui
    //   - signature anterieure a la demande (re-signing requis par RH) -> oui
    //   - signature posterieure ou egale a la demande sur la meme version -> non (deja fait)
    .filter((r) => {
      const sig = latestSignatureByTemplate.get(r.template.id);
      if (!sig) return true;
      if (sig.version !== r.template.version) return true;
      return sig.signedAt < new Date(r.requestedAt);
    })
    // Exclut les templates qui sont couverts par un cahier deja signe.
    .filter((r) => !templatesCoveredByHandbook.has(r.template.id))
    .map((r) => r.template)
    // Deduplication : plusieurs requests peuvent cibler le meme template
    .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i);

  // Cahiers a signer = handbooks actifs dont la version courante n'a pas ete
  // signee par cet employe.
  const handbooksToSign = activeHandbooks.filter(
    (hb) => signedHandbookKey.get(hb.id) !== hb.version,
  );

  return (
    <MyDocumentsView
      employeeId={adminId}
      legalDocs={JSON.parse(JSON.stringify(legalDocs))}
      mySignatures={JSON.parse(JSON.stringify(mySignatures))}
      taxDocs={JSON.parse(JSON.stringify(taxDocs))}
      payStubs={JSON.parse(JSON.stringify(payStubs))}
      contracts={JSON.parse(JSON.stringify(contracts))}
      letterRequests={JSON.parse(JSON.stringify(letterRequests))}
      personalDocs={JSON.parse(JSON.stringify(personalDocs))}
      signatureRequests={JSON.parse(JSON.stringify(signatureRequests))}
      pendingUploadRequests={JSON.parse(JSON.stringify(pendingUploadRequests))}
      handbooksToSign={JSON.parse(JSON.stringify(handbooksToSign))}
      myHandbookSignatures={JSON.parse(JSON.stringify(myHandbookSignatures))}
    />
  );
}
