// Admin login
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ namespace: "auth" });
  return { title: t("admin_login_title") };
}

export default async function AdminLoginPage() {
  const session = await auth();
  if (session?.user?.role === "admin") {
    redirect("/admin");
  }

  return (
    <div className="min-h-screen vnk-gradient flex items-center justify-center p-4">
      <LoginForm />
    </div>
  );
}
