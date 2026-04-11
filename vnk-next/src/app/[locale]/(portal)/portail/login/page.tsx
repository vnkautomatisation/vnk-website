// Portail client — login page
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/routing";
import { PortalLoginForm } from "./login-form";

export default async function PortalLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (session?.user?.role === "client") {
    redirect({ href: "/portail", locale });
  }

  return (
    <div className="min-h-screen vnk-gradient-subtle flex items-center justify-center p-4">
      <PortalLoginForm />
    </div>
  );
}
