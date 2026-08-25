// HR · Vue centralisée des onboardings (qui n'a pas signé quoi, qui manque d'éléments)
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isHrAdmin } from "@/lib/services/hr-access";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ScrollText, AlertCircle, CheckCircle2, ShieldCheck, FileSignature, Fingerprint } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function OnboardingCentralPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  if (!(await isHrAdmin(session.user.adminId!))) redirect("/admin/employes/organigramme");

  const [admins, requiredDocs, allSignatures, passkeys] = await Promise.all([
    prisma.admin.findMany({
      where: { isActive: true },
      orderBy: [{ onboardingDone: "asc" }, { createdAt: "desc" }],
      select: {
        id: true, email: true, fullName: true, avatarUrl: true,
        twoFactorEnabled: true, onboardingDone: true, createdAt: true,
        position: { select: { name: true } },
      },
    }),
    prisma.legalDocumentTemplate.findMany({ where: { isActive: true, isRequired: true } }),
    prisma.legalDocumentSignature.findMany({ select: { templateId: true, adminId: true, version: true } }),
    prisma.adminPasskey.findMany({ select: { adminId: true } }),
  ]);

  const signaturesByAdmin = new Map<number, Set<string>>();
  for (const s of allSignatures) {
    if (!signaturesByAdmin.has(s.adminId)) signaturesByAdmin.set(s.adminId, new Set());
    signaturesByAdmin.get(s.adminId)!.add(`${s.templateId}-${s.version}`);
  }
  const passkeyByAdmin = new Set(passkeys.map((p) => p.adminId));

  const computed = admins.map((a) => {
    const signed = signaturesByAdmin.get(a.id) ?? new Set();
    const unsigned = requiredDocs.filter((d) => !signed.has(`${d.id}-${d.version}`));
    const missing = {
      onboarding: !a.onboardingDone,
      twoFactor: !a.twoFactorEnabled,
      passkey: !passkeyByAdmin.has(a.id),
      docs: unsigned.length,
    };
    const total = (missing.onboarding ? 1 : 0) + (missing.twoFactor ? 1 : 0) + missing.docs;
    return { ...a, missing, totalMissing: total, unsignedTitles: unsigned.map((d) => d.title) };
  });

  const incomplete = computed.filter((c) => c.totalMissing > 0).sort((a, b) => b.totalMissing - a.totalMissing);
  const complete = computed.filter((c) => c.totalMissing === 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-[#0F2D52]" />Onboarding centralisé
        </h1>
        <p className="text-sm text-muted-foreground">
          Vue d&apos;ensemble des activations en cours · qui n&apos;a pas signé quoi · 2FA manquante.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 bg-amber-50/50 border-amber-200">
          <p className="text-xs uppercase tracking-wider font-semibold text-amber-700">Incomplets</p>
          <p className="text-3xl font-bold tabular-nums text-amber-900">{incomplete.length}</p>
        </Card>
        <Card className="p-4 bg-emerald-50/50 border-emerald-200">
          <p className="text-xs uppercase tracking-wider font-semibold text-emerald-700">Complets</p>
          <p className="text-3xl font-bold tabular-nums text-emerald-900">{complete.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Total équipe</p>
          <p className="text-3xl font-bold tabular-nums">{admins.length}</p>
        </Card>
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600" />À compléter ({incomplete.length})
        </h2>
        {incomplete.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Tout le monde est à jour
          </Card>
        ) : (
          <div className="space-y-2">
            {incomplete.map((u) => (
              <Card key={u.id} className="p-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#0F2D52] to-[#15406d] flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={u.avatarUrl ? { backgroundImage: `url(${u.avatarUrl})`, backgroundSize: "cover" } : undefined}>
                    {!u.avatarUrl && (u.fullName || u.email).split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/admin/employes#${u.id}`} className="font-medium text-sm hover:underline">
                      {u.fullName || u.email}
                    </Link>
                    <p className="text-xs text-muted-foreground">{u.position?.name ?? "—"} · ajouté le {new Date(u.createdAt).toLocaleDateString("fr-CA")}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {u.missing.onboarding && <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50"><ScrollText className="h-2.5 w-2.5 mr-1" />Wizard incomplet</Badge>}
                      {u.missing.twoFactor && <Badge variant="outline" className="text-[10px] text-red-700 border-red-300 bg-red-50"><ShieldCheck className="h-2.5 w-2.5 mr-1" />2FA</Badge>}
                      {u.missing.passkey && <Badge variant="outline" className="text-[10px] text-muted-foreground"><Fingerprint className="h-2.5 w-2.5 mr-1" />Pas de passkey</Badge>}
                      {u.missing.docs > 0 && (
                        <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">
                          <FileSignature className="h-2.5 w-2.5 mr-1" />{u.missing.docs} doc{u.missing.docs > 1 ? "s" : ""} non signé{u.missing.docs > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Badge className="bg-amber-100 text-amber-700 text-[10px]">{u.totalMissing} item{u.totalMissing > 1 ? "s" : ""}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {complete.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />Complets ({complete.length})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {complete.map((u) => (
              <div key={u.id} className="flex items-center gap-2 p-2 rounded-md border bg-emerald-50/30 text-sm">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#0F2D52] to-[#15406d] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                  {(u.fullName || u.email).split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <span className="truncate">{u.fullName || u.email}</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 ml-auto" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
