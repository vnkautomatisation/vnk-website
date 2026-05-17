import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Briefcase, Laptop, Smartphone, Wrench, HardHat, Car, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const CAT_META: Record<string, { label: string; icon: typeof Briefcase }> = {
  laptop: { label: "Ordinateur", icon: Laptop },
  phone: { label: "Téléphone", icon: Smartphone },
  tool: { label: "Outil", icon: Wrench },
  epi: { label: "EPI", icon: HardHat },
  vehicle: { label: "Véhicule", icon: Car },
  card: { label: "Carte corpo", icon: CreditCard },
  license: { label: "Licence logiciel", icon: Briefcase },
  other: { label: "Autre", icon: Briefcase },
};

export default async function MyEquipmentPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const items = await prisma.assignedEquipment.findMany({
    where: { adminId },
    orderBy: [{ returnedAt: "asc" }, { assignedAt: "desc" }],
  });

  const current = items.filter((i) => !i.returnedAt);
  const returned = items.filter((i) => i.returnedAt);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-[#0F2D52]" />Mon équipement
        </h1>
        <p className="text-sm text-muted-foreground">
          Matériel d&apos;entreprise sous votre responsabilité. À retourner lors de votre départ.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          En ma possession ({current.length})
        </h2>
        {current.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Aucun équipement attribué.</Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {current.map((eq) => {
              const meta = CAT_META[eq.category] ?? CAT_META.other;
              const Icon = meta.icon;
              return (
                <Card key={eq.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <Icon className="h-5 w-5 text-[#0F2D52] shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm">{eq.name}</h3>
                        <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                      </div>
                      {(eq.brand || eq.model) && <p className="text-xs text-muted-foreground">{[eq.brand, eq.model].filter(Boolean).join(" · ")}</p>}
                      {eq.serialNumber && <p className="text-[11px] font-mono text-muted-foreground">S/N : {eq.serialNumber}</p>}
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Assigné le {new Date(eq.assignedAt).toLocaleDateString("fr-CA")}
                      </p>
                      {eq.notes && <p className="text-[11px] italic text-muted-foreground mt-0.5">{eq.notes}</p>}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {returned.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Retourné ({returned.length})
          </h2>
          <Card>
            <div className="divide-y">
              {returned.map((eq) => {
                const meta = CAT_META[eq.category] ?? CAT_META.other;
                const Icon = meta.icon;
                return (
                  <div key={eq.id} className="p-3 flex items-center gap-3 text-sm">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 line-through text-muted-foreground">{eq.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      Retourné {new Date(eq.returnedAt!).toLocaleDateString("fr-CA")}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>
      )}

      <p className="text-[11px] text-muted-foreground italic">
        Pour ajouter ou modifier un équipement : contactez les RH. L&apos;attribution est gérée par eux.
      </p>
    </div>
  );
}
