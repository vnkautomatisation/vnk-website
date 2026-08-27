// Page publique d'acceptation d'invitation admin.
// Le user arrive via le lien email avec ?token=xxx.
// On valide le token (non expiré, non révoqué, non utilisé), puis on affiche
// un formulaire de création de mot de passe.
import crypto from "crypto";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { AcceptInviteForm } from "./accept-invite-form";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("activation_de_compte") };
}

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const t = await getTranslations("auth");
  const params = await searchParams;
  const token = params.token ?? "";

  if (!token) {
    return (
      <ErrorState
        title={t("lien_invalide")}
        linkLabel={t("aller_page_connexion")}
        message={t("aucun_token_n_ete_fourni")}
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
        title={t("lien_invalide")}
        linkLabel={t("aller_page_connexion")}
        message={t("invitation_n_existe_pas_demandez")}
      />
    );
  }

  if (invitation.revokedAt) {
    return (
      <ErrorState
        title={t("invitation_annulee")}
        linkLabel={t("aller_page_connexion")}
        message={t("invitation_ete_annulee_administrateur")}
      />
    );
  }

  if (invitation.acceptedAt) {
    return (
      <ErrorState
        title={t("compte_deja_cree")}
        linkLabel={t("aller_page_connexion")}
        message={t("invitation_deja_ete_utilisee_connectez")}
      />
    );
  }

  if (invitation.expiresAt < new Date()) {
    return (
      <ErrorState
        title={t("lien_expire")}
        linkLabel={t("aller_page_connexion")}
        message={t("invitation_expire_demandez_administrateur_vous")}
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

function ErrorState({ title, message, linkLabel }: { title: string; message: string; linkLabel: string }) {
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
          {linkLabel}
        </a>
      </div>
    </div>
  );
}
