// Page "mot de passe oublié" admin — étape 1 : demande email
import { ForgotPasswordForm } from "./forgot-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mot de passe oublié — VNK" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm audience="admin" />;
}
