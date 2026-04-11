// Admin public group (login page) — NextIntlClientProvider + Toaster
// Ce groupe ne passe PAS par AdminLayout → pas de check auth
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";

export default async function AdminPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
      <Toaster />
    </NextIntlClientProvider>
  );
}
