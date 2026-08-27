// Page de saisie du code + nouveau mot de passe
import { ResetPasswordForm } from "./reset-form";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("titre_reinitialiser_mdp") };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return <ResetPasswordForm tokenFromUrl={params.token ?? null} audience="admin" />;
}
