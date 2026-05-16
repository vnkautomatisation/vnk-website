"use client";
// Hook React pour vérifier les permissions de l'admin courant côté client.
// Charge une fois la matrice depuis l'API, met en cache au niveau navigateur.
//
// Exemple :
//   const { can, isSuperAdmin } = usePermissions();
//   {can("users", "write") && <Button>Créer un utilisateur</Button>}
import { useEffect, useState } from "react";

type Action = "read" | "write" | "delete" | "export";

export type ClientPermissions = {
  authenticated: boolean;
  adminId?: number;
  email?: string;
  roleName?: string | null;
  isSuperAdmin?: boolean;
  matrix?: Partial<Record<string, Action[]>>;
};

let cache: { data: ClientPermissions; expires: number } | null = null;
const TTL = 60_000;

export function usePermissions() {
  const [perms, setPerms] = useState<ClientPermissions | null>(cache?.data ?? null);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache && cache.expires > Date.now()) {
      setPerms(cache.data);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch("/api/admin/me/permissions", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: ClientPermissions) => {
        if (cancelled) return;
        cache = { data: d, expires: Date.now() + TTL };
        setPerms(d);
      })
      .catch(() => {
        if (!cancelled) setPerms({ authenticated: false });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const can = (resource: string, action: Action): boolean => {
    if (!perms?.authenticated) return false;
    if (perms.isSuperAdmin) return true;
    return (perms.matrix?.[resource] ?? []).includes(action);
  };

  return {
    loading,
    authenticated: !!perms?.authenticated,
    adminId: perms?.adminId,
    roleName: perms?.roleName,
    isSuperAdmin: !!perms?.isSuperAdmin,
    matrix: perms?.matrix ?? {},
    can,
  };
}

// Helper pour invalider le cache (à appeler après une modif de rôle).
export function invalidatePermissionsCache() {
  cache = null;
}
