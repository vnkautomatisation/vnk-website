// API · Récupère les permissions de l'admin courant pour le client.
// Cache 30 secondes côté navigateur (les permissions changent rarement).
import { NextResponse } from "next/server";
import { getCurrentAdminPermissions } from "@/lib/permissions";

export async function GET() {
  const perms = await getCurrentAdminPermissions();
  if (!perms) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json(
    {
      authenticated: true,
      adminId: perms.adminId,
      email: perms.email,
      roleName: perms.roleName,
      isSuperAdmin: perms.isSuperAdmin,
      matrix: perms.matrix,
    },
    {
      headers: { "Cache-Control": "private, max-age=30" },
    }
  );
}
