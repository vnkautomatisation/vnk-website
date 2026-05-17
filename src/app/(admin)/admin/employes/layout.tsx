// Layout du module Employés — navigation latérale partagée par toutes les sous-pages.
import { EmployesNav } from "./employes-nav";

export default function EmployesLayout({ children }: { children: React.ReactNode }) {
  return (
    // display:contents en mobile pour que la barre menu sticky ait pour parent
    // le flex container (qui est tall = toute la page), pas son petit wrapper.
    // Sur lg+ le wrapper redevient un vrai block avec w-60 (sidebar fixe).
    <div className="flex flex-col lg:flex-row lg:gap-4">
      <div className="contents lg:block lg:w-60 lg:flex-shrink-0">
        <EmployesNav />
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
