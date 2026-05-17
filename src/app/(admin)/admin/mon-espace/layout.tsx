import { MonEspaceNav } from "./mon-espace-nav";

export default function MonEspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row lg:gap-4">
      <div className="lg:w-60 lg:flex-shrink-0">
        <MonEspaceNav />
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
