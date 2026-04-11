import { setRequestLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { TrendingUp, CheckCircle, Clock, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default async function FinancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "admin.transactions" });

  const [paid, receivable, invoiced] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { amountTtc: true },
      where: { status: "paid" },
    }),
    prisma.invoice.aggregate({
      _sum: { amountTtc: true },
      where: { status: { in: ["unpaid", "overdue"] } },
    }),
    prisma.invoice.aggregate({ _sum: { amountTtc: true } }),
  ]);

  const kpis = [
    {
      label: "Total payé",
      value: formatCurrency(Number(paid._sum.amountTtc ?? 0)),
      icon: CheckCircle,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "À recevoir",
      value: formatCurrency(Number(receivable._sum.amountTtc ?? 0)),
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Total facturé",
      value: formatCurrency(Number(invoiced._sum.amountTtc ?? 0)),
      icon: FileText,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Finance" subtitle="Paiements, statistiques et taxes" icon={TrendingUp} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="vnk-card-hover">
              <CardContent className="p-5">
                <div className={`h-11 w-11 rounded-lg ${k.bg} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${k.color}`} />
                </div>
                <p className="text-xs text-muted-foreground uppercase mt-4">{k.label}</p>
                <p className="text-2xl font-bold mt-1">{k.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
