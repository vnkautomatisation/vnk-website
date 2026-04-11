import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Mail, Phone, MapPin } from "lucide-react";

export function PublicFooter() {
  const t = useTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#0F2D52] text-white/90 pt-14 pb-6">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
                <span className="font-bold text-sm">VNK</span>
              </div>
              <div>
                <div className="font-bold">Automatisation Inc.</div>
                <div className="text-[9px] opacity-60">VALUE · NETWORK · KNOWLEDGE</div>
              </div>
            </div>
            <p className="text-sm opacity-75">
              Services d&apos;automatisation industrielle — PLC, SCADA, HMI.
            </p>
          </div>

          {/* Services */}
          <div>
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider">
              {t("home.services_section.title")}
            </h3>
            <ul className="space-y-2 text-sm opacity-75">
              <li><Link href="/services" className="hover:text-white">{t("services.support_plc.title")}</Link></li>
              <li><Link href="/services" className="hover:text-white">{t("services.audit.title")}</Link></li>
              <li><Link href="/services" className="hover:text-white">{t("services.documentation.title")}</Link></li>
              <li><Link href="/services" className="hover:text-white">{t("services.refactoring.title")}</Link></li>
            </ul>
          </div>

          {/* Nav */}
          <div>
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider">
              Liens
            </h3>
            <ul className="space-y-2 text-sm opacity-75">
              <li><Link href="/" className="hover:text-white">{t("nav.home")}</Link></li>
              <li><Link href="/a-propos" className="hover:text-white">{t("nav.about")}</Link></li>
              <li><Link href="/contact" className="hover:text-white">{t("nav.contact")}</Link></li>
              <li><Link href="/portail" className="hover:text-white">{t("nav.portal")}</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider">
              Contact
            </h3>
            <ul className="space-y-2 text-sm opacity-75">
              <li className="flex items-center gap-2"><Mail className="h-4 w-4 opacity-60" /> vnkautomatisation@gmail.com</li>
              <li className="flex items-center gap-2"><MapPin className="h-4 w-4 opacity-60" /> Québec, Canada</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 text-xs opacity-60 flex flex-col md:flex-row justify-between gap-2">
          <p>© {year} VNK Automatisation Inc. Tous droits réservés.</p>
          <p>Site web conçu et développé à Québec.</p>
        </div>
      </div>
    </footer>
  );
}
