// Settings · Catalogues — services offerts, codes promo, étiquettes,
// sources, industries, catégories de dépenses, statuts workflow, devises.
// Vue server qui charge tous les catalogues en parallèle.
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getCurrentAdminPermissions, canAct } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { CatalogsView } from "./catalogs-view";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("catalogues_vnk") };
}

export default async function CatalogsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  // Acces reglages : settings.write requis.
  const perms = await getCurrentAdminPermissions();
  if (!canAct(perms, "settings", "write")) redirect("/admin");

  const [services, promos, catalogItems] = await Promise.all([
    prisma.serviceCatalog.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.discountCode.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.catalogItem.findMany({ orderBy: [{ type: "asc" }, { sortOrder: "asc" }] }),
  ]);

  return (
    <CatalogsView
      services={JSON.parse(JSON.stringify(services))}
      promos={JSON.parse(JSON.stringify(promos))}
      catalogItems={JSON.parse(JSON.stringify(catalogItems))}
    />
  );
}
