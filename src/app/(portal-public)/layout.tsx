// Portal public group (login page) — NextIntlClientProvider + Toaster
// Ce groupe ne passe PAS par PortalLayout → pas de check auth
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { NavigationFeedback } from "@/components/navigation-feedback";

export default async function PortalPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <Suspense fallback={null}>
        <NavigationFeedback />
      </Suspense>
      {children}
      <Toaster />
    </NextIntlClientProvider>
  );
}
