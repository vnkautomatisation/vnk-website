// Page "mot de passe oublié" admin — étape 1 : demande email
import { ForgotPasswordForm } from "./forgot-form";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("titre_mot_passe_oublie") };
}

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  return <ForgotPasswordForm audience="admin" />;
}
