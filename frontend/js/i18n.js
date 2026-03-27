/* ============================================
   VNK Automatisation Inc. - i18n System
   ============================================ */

const translations = {
    fr: {
        // Navigation
        'nav.home': 'Accueil',
        'nav.services': 'Services',
        'nav.about': 'À propos',
        'nav.contact': 'Contact',
        'nav.portal': 'Portail client',

        // Hero
        'hero.badge': "Services d'automatisation industrielle",
        'hero.title1': 'Solutions PLC,',
        'hero.title2': 'SCADA & HMI',
        'hero.title3': "pour l'industrie",
        'hero.subtitle': "Support technique à distance, audits, documentation et modernisation de systèmes automatisés pour les entreprises industrielles au Québec.",
        'hero.cta.primary': 'Réserver une consultation',
        'hero.cta.secondary': 'Voir les services',
        'hero.stats.services': 'Services spécialisés',
        'hero.stats.brands': "Marques d'automates",
        'hero.stats.market': 'Marché industriel',

        // Services
        'services.title': 'Nos services',
        'services.subtitle': 'Solutions techniques adaptées à vos besoins industriels',
        'services.plc.title': 'Support PLC à distance',
        'services.plc.desc': "Diagnostic et résolution rapide de pannes sur vos automates Siemens, Rockwell, B&R et Schneider.",
        'services.plc.price': '120–150 CAD/h',
        'services.audit.title': 'Audit technique',
        'services.audit.desc': "Évaluation complète de votre système d'automatisation — risques, performance et recommandations.",
        'services.audit.price': '1 500–4 000 CAD',
        'services.doc.title': 'Documentation industrielle',
        'services.doc.desc': "Création de procédures opérateur, maintenance, dépannage et documentation complète du code PLC.",
        'services.doc.price': '800–5 000 CAD',
        'services.refactor.title': 'Refactorisation PLC',
        'services.refactor.desc': "Modernisation et restructuration de code legacy — amélioration de la fiabilité et de la maintenabilité.",
        'services.refactor.price': '3 000–50 000 CAD',
        'services.learn_more': 'En savoir plus →',
        'services.all': 'Voir tous les services',

        // Brands
        'brands.title': 'Automates supportés',

        // Why VNK
        'why.title': 'Pourquoi VNK ?',
        'why.specialized.title': 'Spécialisé',
        'why.specialized.desc': "Focus exclusif sur l'automatisation industrielle — pas de généraliste.",
        'why.remote.title': 'À distance',
        'why.remote.desc': "Intervention rapide sans délai de déplacement — disponibilité maximale.",
        'why.documented.title': 'Documenté',
        'why.documented.desc': "Chaque intervention est documentée — rapport écrit systématique.",
        'why.structured.title': 'Structuré',
        'why.structured.desc': "Contrat, devis et facturation professionnels à chaque mandat.",

        // CTA
        'cta.title': 'Prêt à optimiser votre système ?',
        'cta.subtitle': 'Réservez une consultation gratuite de 30 minutes pour discuter de vos besoins.',
        'cta.button': 'Réserver maintenant',

        // Footer
        'footer.services': 'Services',
        'footer.company': 'Entreprise',
        'footer.contact': 'Contact',
        'footer.copyright': '© 2026 VNK Automatisation Inc. Tous droits réservés.'
    },

    en: {
        // Navigation
        'nav.home': 'Home',
        'nav.services': 'Services',
        'nav.about': 'About',
        'nav.contact': 'Contact',
        'nav.portal': 'Client Portal',

        // Hero
        'hero.badge': 'Industrial Automation Services',
        'hero.title1': 'PLC, SCADA &',
        'hero.title2': 'HMI Solutions',
        'hero.title3': 'for Industry',
        'hero.subtitle': 'Remote technical support, audits, documentation and modernization of automated systems for industrial companies in Quebec.',
        'hero.cta.primary': 'Book a Consultation',
        'hero.cta.secondary': 'View Services',
        'hero.stats.services': 'Specialized Services',
        'hero.stats.brands': 'PLC Brands',
        'hero.stats.market': 'B2B Market',

        // Services
        'services.title': 'Our Services',
        'services.subtitle': 'Technical solutions tailored to your industrial needs',
        'services.plc.title': 'Remote PLC Support',
        'services.plc.desc': 'Fast diagnosis and troubleshooting for Siemens, Rockwell, B&R and Schneider controllers.',
        'services.plc.price': '$120–150 CAD/h',
        'services.audit.title': 'Technical Audit',
        'services.audit.desc': 'Complete assessment of your automation system — risks, performance and recommendations.',
        'services.audit.price': '$1,500–4,000 CAD',
        'services.doc.title': 'Industrial Documentation',
        'services.doc.desc': 'Creation of operator procedures, maintenance, troubleshooting and complete PLC code documentation.',
        'services.doc.price': '$800–5,000 CAD',
        'services.refactor.title': 'PLC Refactoring',
        'services.refactor.desc': 'Modernization and restructuring of legacy code — improved reliability and maintainability.',
        'services.refactor.price': '$3,000–50,000 CAD',
        'services.learn_more': 'Learn more →',
        'services.all': 'View all services',

        // Brands
        'brands.title': 'Supported PLCs',

        // Why VNK
        'why.title': 'Why VNK?',
        'why.specialized.title': 'Specialized',
        'why.specialized.desc': 'Exclusive focus on industrial automation — no generalists.',
        'why.remote.title': 'Remote',
        'why.remote.desc': 'Fast response without travel delays — maximum availability.',
        'why.documented.title': 'Documented',
        'why.documented.desc': 'Every intervention is documented — systematic written report.',
        'why.structured.title': 'Structured',
        'why.structured.desc': 'Professional contract, quote and invoicing for every mandate.',

        // CTA
        'cta.title': 'Ready to optimize your system?',
        'cta.subtitle': 'Book a free 30-minute consultation to discuss your needs.',
        'cta.button': 'Book Now',

        // Footer
        'footer.services': 'Services',
        'footer.company': 'Company',
        'footer.contact': 'Contact',
        'footer.copyright': '© 2026 VNK Automatisation Inc. All rights reserved.'
    }
};

// ---------- i18n Engine ----------
window.i18n = {
    currentLang: localStorage.getItem('vnk-lang') || 'fr',

    setLanguage(lang) {
        this.currentLang = lang;
        localStorage.setItem('vnk-lang', lang);
        this.applyTranslations();
    },

    t(key) {
        return translations[this.currentLang][key] || key;
    },

    applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.t(key);
            if (translation) {
                el.textContent = translation;
            }
        });
        document.documentElement.lang = this.currentLang;
    }
};

// Apply translations on load
document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('vnk-lang') || 'fr';
    window.i18n.setLanguage(savedLang);
    const langToggle = document.getElementById('lang-toggle');
    if (langToggle) {
        langToggle.textContent = savedLang === 'fr' ? 'EN' : 'FR';
    }
});