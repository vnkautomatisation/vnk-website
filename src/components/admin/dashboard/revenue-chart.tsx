"use client";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import { formatCurrency } from "@/lib/utils";

type MonthData = {
  month: string;
  revenue: number;
};

export function RevenueChart({ data }: { data: MonthData[] }) {
  const t = useTranslations("admin.ui");
  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="font-semibold text-sm mb-4">{t("revenus_6_derniers_mois")}</h3>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            {t("aucune_donnee_disponible")}
          </p>
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1B4F8A" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#1B4F8A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#94A3B8" }}
                  axisLine={{ stroke: "#E2E8F0" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94A3B8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #E2E8F0",
                    borderRadius: "8px",
                    fontSize: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}
                  formatter={(value) => [formatCurrency(Number(value ?? 0)), t("revenus")]}
                  labelStyle={{ color: "#64748B", fontWeight: 600 }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#1B4F8A"
                  strokeWidth={2}
                  fill="url(#colorRevenue)"
                  dot={{ r: 4, fill: "#1B4F8A", stroke: "white", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "#1B4F8A", stroke: "white", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
