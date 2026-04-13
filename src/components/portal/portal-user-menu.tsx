"use client";
import { useState, useRef, useEffect } from "react";
import { signOut } from "next-auth/react";
import { User, LogOut, Settings } from "lucide-react";
import Link from "next/link";

export function PortalUserMenu({ name, initials }: { name: string; initials: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="h-9 w-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white text-xs font-bold hover:bg-white/30 transition-colors"
        aria-label="Menu utilisateur"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-56 bg-card rounded-xl shadow-2xl border z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-3 border-b">
            <p className="text-sm font-semibold truncate">{name}</p>
            <p className="text-xs text-muted-foreground">Client</p>
          </div>
          <div className="p-1">
            <Link
              href="/portail/profil"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
            >
              <User className="h-4 w-4 text-muted-foreground" />
              Profil
            </Link>
            <Link
              href="/portail/parametres"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              Parametres
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/portail/login" })}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Deconnexion
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
