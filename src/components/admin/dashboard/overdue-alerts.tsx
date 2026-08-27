import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";

type OverdueInvoice = {
  id: number;
  invoiceNumber: string;
  clientName: string;
  amountTtc: number;
  dueDate: string;
};

export function OverdueAlerts({
  invoices,
}: {
  invoices: OverdueInvoice[];
}) {
  const t = useTranslations("admin.ui");
  if (invoices.length === 0) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-emerald-800">
              {t("tout_jour")}
            </p>
            <p className="text-xs text-emerald-600">
              {t("aucune_facture_retard")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {invoices.length} facture{invoices.length > 1 ? "s" : ""} en retard
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {invoices.slice(0, 5).map((inv) => {
            const daysOverdue = Math.floor(
              (Date.now() - new Date(inv.dueDate).getTime()) / 86400000
            );
            return (
              <Link
                key={inv.id}
                href="/admin/invoices"
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-amber-100/50 transition-colors group"
              >
                <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-amber-900 truncate">
                    {inv.invoiceNumber} - {inv.clientName}
                  </p>
                  <p className="text-[10px] text-amber-600">
                    {daysOverdue} jour{daysOverdue > 1 ? "s" : ""} en retard
                  </p>
                </div>
                <span className="text-xs font-semibold text-amber-800">
                  {formatCurrency(inv.amountTtc)}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </Link>
            );
          })}
        </div>

        {invoices.length > 5 && (
          <Link
            href="/admin/invoices"
            className="block text-center text-xs text-amber-700 font-medium mt-3 hover:underline"
          >
            Voir les {invoices.length} factures en retard
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
