// Admin group layout : wraps admin routes with NextIntlClientProvider
// Locale read from NEXT_LOCALE cookie (no URL prefix on /admin/*)
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";

export default async function AdminGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  // The whole catalogue: this layout renders once per hard load and is kept
  // across client-side navigation, so a per-route subset would leave later
  // pages without their namespaces.
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
      <Toaster />
    </NextIntlClientProvider>
  );
}
