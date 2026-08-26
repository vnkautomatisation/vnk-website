// Time clock settings: the 7 "hr_pointage" values, which had no UI at all
// (DB-only edits). Gated on the "timeclock" HR domain.
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { isHrAdmin } from "@/lib/services/hr-access";
import { getTimeclockConfig } from "@/lib/services/timeclock-config";
import { redirect } from "next/navigation";
import { TimeclockSettingsView } from "./timeclock-settings-view";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Paramètres du pointage" };

const PIN_PAGE_SIZE = 10;

export default async function TimeclockSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ pinQ?: string; pinPage?: string; pinFilter?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  if (!(await isHrAdmin(session.user.adminId!, { domain: "timeclock" }))) {
    redirect("/admin/employes/pointage");
  }

  const sp = await searchParams;
  const pinQ = (sp.pinQ ?? "").trim();
  const pinFilter = sp.pinFilter === "requested" || sp.pinFilter === "none" ? sp.pinFilter : "all";
  const pinPage = Math.max(1, Number(sp.pinPage) || 1);

  const config = await getTimeclockConfig();

  // PIN state per employee, never its value. Paginated and filtered in SQL so
  // only the visible page is loaded, whatever the headcount.
  const like = `%${pinQ.toLowerCase()}%`;
  const filterSql = Prisma.sql`
    is_active = true AND role = 'admin'
    ${pinQ ? Prisma.sql`AND (LOWER(COALESCE(full_name, '')) LIKE ${like} OR LOWER(email) LIKE ${like})` : Prisma.empty}
    ${pinFilter === "requested" ? Prisma.sql`AND kiosk_pin_requested_at IS NOT NULL` : Prisma.empty}
    ${pinFilter === "none" ? Prisma.sql`AND kiosk_pin_hash IS NULL` : Prisma.empty}
  `;

  const [rows, totalRows, statRows] = await Promise.all([
    prisma.$queryRaw<Array<{
      id: number;
      full_name: string | null;
      email: string;
      has_pin: boolean;
      can_reveal: boolean;
      set_at: Date | null;
      requested_at: Date | null;
    }>>`
      SELECT id, full_name, email,
             (kiosk_pin_hash IS NOT NULL) AS has_pin,
             (kiosk_pin_enc IS NOT NULL) AS can_reveal,
             kiosk_pin_set_at AS set_at,
             kiosk_pin_requested_at AS requested_at
      FROM admins
      WHERE ${filterSql}
      ORDER BY (kiosk_pin_requested_at IS NOT NULL) DESC,
               kiosk_pin_requested_at ASC,
               full_name ASC NULLS LAST, email ASC
      LIMIT ${PIN_PAGE_SIZE} OFFSET ${(pinPage - 1) * PIN_PAGE_SIZE}
    `,
    prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(*)::bigint AS n FROM admins WHERE ${filterSql}
    `,
    prisma.$queryRaw<Array<{ total: bigint; with_pin: bigint; requested: bigint }>>`
      SELECT COUNT(*)::bigint AS total,
             COUNT(*) FILTER (WHERE kiosk_pin_hash IS NOT NULL)::bigint AS with_pin,
             COUNT(*) FILTER (WHERE kiosk_pin_requested_at IS NOT NULL)::bigint AS requested
      FROM admins WHERE is_active = true AND role = 'admin'
    `,
  ]);

  return (
    <TimeclockSettingsView
      config={config}
      employees={rows.map((e) => ({
        id: e.id,
        name: e.full_name || e.email,
        email: e.email,
        hasPin: e.has_pin,
        canReveal: e.can_reveal,
        setAt: e.set_at ? new Date(e.set_at).toISOString() : null,
        requestedAt: e.requested_at ? new Date(e.requested_at).toISOString() : null,
      }))}
      pinList={{
        q: pinQ,
        filter: pinFilter,
        page: pinPage,
        pageSize: PIN_PAGE_SIZE,
        total: Number(totalRows[0]?.n ?? 0),
        totalEmployees: Number(statRows[0]?.total ?? 0),
        withPin: Number(statRows[0]?.with_pin ?? 0),
        requested: Number(statRows[0]?.requested ?? 0),
      }}
    />
  );
}
