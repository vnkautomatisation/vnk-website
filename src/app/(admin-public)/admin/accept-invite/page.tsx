// Page publique d'acceptation d'invitation admin.
// Le user arrive via le lien email avec ?token=xxx.
// On valide le token (non expiré, non révoqué, non utilisé), puis on affiche
// un formulaire de création de mot de passe.
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { AcceptInviteForm } from "./accept-invite-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Activation de compte — VNK",
};

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? "";

  if (!token) {
    return (
      <ErrorState
        title="Lien invalide"
        message="Aucun token n'a été fourni. Vérifiez votre lien d'invitation."
      />
    );
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const invitation = await prisma.adminInvitation.findUnique({
    where: { tokenHash },
  });

  if (!invitation) {
    return (
      <ErrorState
        title="Lien invalide"
        message="Cette invitation n'existe pas. Demandez à votre administrateur de vous en renvoyer une."
      />
    );
  }

  if (invitation.revokedAt) {
    return (
      <ErrorState
        title="Invitation annulée"
        message="Cette invitation a été annulée par votre administrateur."
      />
    );
  }

  if (invitation.acceptedAt) {
    return (
      <ErrorState
        title="Compte déjà créé"
        message="Cette invitation a déjà été utilisée. Connectez-vous directement sur /admin/login."
      />
    );
  }

  if (invitation.expiresAt < new Date()) {
    return (
      <ErrorState
        title="Lien expiré"
        message="Cette invitation a expiré. Demandez à votre administrateur de vous en renvoyer une nouvelle."
      />
    );
  }

  return (
    <AcceptInviteForm
      token={token}
      email={invitation.email}
      fullName={invitation.fullName ?? ""}
    />
  );
}

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="h-16 w-16 rounded-full bg-red-50 mx-auto flex items-center justify-center mb-4">
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-red-500 fill-none stroke-current stroke-2">
            <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[#0F2D52]">{title}</h1>
        <p className="text-sm text-muted-foreground mt-2">{message}</p>
        <a href="/admin/login" className="inline-block mt-6 text-sm text-[#0F2D52] hover:underline">
          Aller à la page de connexion →
        </a>
      </div>
    </div>
  );
}
