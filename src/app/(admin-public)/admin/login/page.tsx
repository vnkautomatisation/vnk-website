// Admin login
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { auth, devBypassOn } from "@/lib/auth";
import { LoginForm } from "./login-form";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("admin_login_title") };
}

export default async function AdminLoginPage() {
  const session = await auth();
  // Le contournement de dev n'est pas visible du middleware (runtime Edge),
  // qui renverrait aussitot ici : rediriger sur une session ainsi obtenue
  // bouclait entre /admin et cette page. Seule une vraie session compte.
  if (session?.user?.role === "admin" && !devBypassOn()) {
    redirect("/admin");
  }

  return (
    <div className="min-h-screen vnk-gradient flex items-center justify-center p-4">
      <LoginForm />
    </div>
  );
}
