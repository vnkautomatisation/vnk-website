// Locale layout : wraps everything with NextIntlClientProvider
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Toaster } from "@/components/ui/sonner";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: segment } = await params;

  if (!routing.locales.includes(segment as "fr" | "en")) {
    notFound();
  }

  setRequestLocale(segment);
  // Le segment n'est pas toujours la langue affichee : le portail est reecrit
  // sur /fr quelle que soit la preference du client. Le fournisseur doit donc
  // recevoir la langue resolue, sinon useLocale() renvoie "fr" et les montants
  // et dates sortent en francais sous un texte anglais.
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
      <Toaster />
    </NextIntlClientProvider>
  );
}
