// HR · Vue d'ensemble des permis pros (toutes équipes) + alertes expiration
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BadgeCheck, AlertTriangle, AlertCircle, XCircle, CheckCircle2, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function HrLicensesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");

  const today = new Date();
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const in90Days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  const all = await prisma.professionalLicense.findMany({
    include: { admin: { select: { id: true, fullName: true, email: true, isActive: true } } },
    orderBy: { expiresAt: "asc" },
  });

  const expired = all.filter((l) => l.expiresAt && new Date(l.expiresAt) < today && l.admin.isActive);
  const critical = all.filter((l) => l.expiresAt && new Date(l.expiresAt) >= today && new Date(l.expiresAt) < in30Days && l.admin.isActive);
  const warning = all.filter((l) => l.expiresAt && new Date(l.expiresAt) >= in30Days && new Date(l.expiresAt) < in90Days && l.admin.isActive);
  const valid = all.filter((l) => !l.expiresAt || new Date(l.expiresAt) >= in90Days);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <BadgeCheck className="h-5 w-5 text-[#0F2D52]" />Permis & certifications
        </h1>
        <p className="text-sm text-muted-foreground">
          Surveillance des permis pros de tout le personnel · alertes d&apos;expiration.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiBox label="Expirés" value={expired.length} accent="red" />
        <KpiBox label="< 30 jours" value={critical.length} accent="amber" />
        <KpiBox label="< 90 jours" value={warning.length} accent="blue" />
        <KpiBox label="Valides" value={valid.length} accent="emerald" />
      </div>

      {expired.length > 0 && <Section title="Expirés" icon={XCircle} iconColor="text-red-600" rows={expired} variant="red" />}
      {critical.length > 0 && <Section title="Critiques (< 30 jours)" icon={AlertTriangle} iconColor="text-amber-600" rows={critical} variant="amber" />}
      {warning.length > 0 && <Section title="À surveiller (30-90 jours)" icon={AlertCircle} iconColor="text-blue-600" rows={warning} variant="blue" />}
      <Section title="Valides" icon={CheckCircle2} iconColor="text-emerald-600" rows={valid} variant="emerald" />
    </div>
  );
}

function KpiBox({ label, value, accent }: { label: string; value: number; accent: "red" | "amber" | "blue" | "emerald" }) {
  const map = {
    red: "bg-red-50 border-red-200 text-red-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
  };
  return (
    <Card className={`p-3 ${map[accent]}`}>
      <p className="text-xs uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </Card>
  );
}

type Row = {
  id: number; type: string; number: string | null; issuer: string | null;
  expiresAt: Date | null; isMandatory: boolean;
  admin: { id: number; fullName: string | null; email: string };
};

function Section({ title, icon: Icon, iconColor, rows, variant }: { title: string; icon: LucideIcon; iconColor: string; rows: Row[]; variant: "red" | "amber" | "blue" | "emerald" }) {
  void variant;
  return (
    <section>
      <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        {title} ({rows.length})
      </h2>
      <Card>
        <div className="divide-y">
          {rows.map((l) => {
            const days = l.expiresAt ? Math.floor((new Date(l.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null;
            return (
              <div key={l.id} className="p-3 flex items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{l.admin.fullName || l.admin.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.type}{l.number && ` · ${l.number}`}{l.issuer && ` · ${l.issuer}`}
                  </p>
                </div>
                <div className="text-right">
                  {l.isMandatory && <Badge variant="outline" className="text-[9px] text-red-700 border-red-300 bg-red-50 mb-1">Obligatoire</Badge>}
                  <p className="text-xs">
                    {l.expiresAt ? (
                      <span>
                        Expire le {new Date(l.expiresAt).toLocaleDateString("fr-CA")}
                        {days !== null && days >= 0 && <span className="text-muted-foreground"> · {days}j</span>}
                        {days !== null && days < 0 && <span className="text-red-600 font-semibold"> · expiré depuis {-days}j</span>}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">Pas d&apos;expiration</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
