// Layout du module Personnel — navigation latérale partagée par toutes les sous-pages.
// Calcule isHr côté serveur pour filtrer les items du menu : un non-RH
// (manager, employé) ne voit que les pages auxquelles il a réellement accès
// (les pages elles-mêmes restent gated individuellement — le menu n'est que
// de l'affichage).
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getHrDomains } from "@/lib/services/hr-access";
import { EmployesNav } from "./employes-nav";

export default async function EmployesLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const { isHr, domains } = await getHrDomains(session.user.adminId!);
  return (
    // display:contents en mobile pour que la barre menu sticky ait pour parent
    // le flex container (qui est tall = toute la page), pas son petit wrapper.
    // Sur lg+ le wrapper redevient un vrai block avec w-60 (sidebar fixe).
    <div className="flex flex-col lg:flex-row lg:gap-4">
      <div className="contents lg:block lg:w-60 lg:flex-shrink-0">
        <EmployesNav isHr={isHr} domains={domains} />
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
