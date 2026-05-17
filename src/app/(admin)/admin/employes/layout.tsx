// Layout du module Employés — navigation latérale partagée par toutes les sous-pages.
import { EmployesNav } from "./employes-nav";

export default function EmployesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row lg:gap-4">
      <div className="lg:w-60 lg:flex-shrink-0">
        <EmployesNav />
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
