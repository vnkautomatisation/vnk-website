"use client";
// Le portail signe et se deconnecte sur son propre espace NextAuth, distinct
// de celui de l'admin : c'est ce qui permet d'etre connecte aux deux a la fois.
import { SessionProvider } from "next-auth/react";

export const PORTAL_AUTH_BASE_PATH = "/api/auth/client";

export function PortalSessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath={PORTAL_AUTH_BASE_PATH} session={null}>
      {children}
    </SessionProvider>
  );
}
