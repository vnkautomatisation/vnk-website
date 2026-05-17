// Page de saisie du code + nouveau mot de passe
import { ResetPasswordForm } from "./reset-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Réinitialiser le mot de passe — VNK" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return <ResetPasswordForm tokenFromUrl={params.token ?? null} audience="admin" />;
}
