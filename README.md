# VNK Automatisation Inc.

Site web, portail client et dashboard administrateur construits en **Next.js 15 + TypeScript + Prisma + PostgreSQL**.

> **Version 2.0** — Refonte complète depuis l'ancienne stack Express/HTML. L'ancien code (`backend/`, `frontend/`, `server.js`) a été retiré au profit de l'architecture Next.js unifiée.

---

## 🚀 Démarrage

```powershell
# 1. Installer les dépendances
npm install

# 2. Copier et éditer le fichier d'environnement
Copy-Item .env.example .env.local
notepad .env.local
# (renseigner DATABASE_URL, AUTH_SECRET, Stripe, SMTP)

# 3. Prisma — générer le client + appliquer le schéma
npm run db:generate
npm run db:push
npm run db:seed

# 4. Lancer le serveur de dev sur http://localhost:3000
npm run dev
```

**Compte admin initial** (seedé automatiquement) :
- Courriel : `vnkautomatisation@gmail.com`
- Mot de passe : `AdminVNK2026!` ⚠️ à changer via `/admin/profil` après la première connexion

---

## 🏗️ Architecture

```
vnk-website/
├── messages/                          # i18n FR + EN (~700 clés)
│   ├── fr.json
│   └── en.json
├── prisma/
│   ├── schema.prisma                  # Source de vérité du schéma
│   ├── migrations/20260411_000_init/  # Migration SQL idempotente
│   ├── seed.ts                        # Admin + 120 settings + catalogue
│   └── seed-email-templates.ts        # 10 templates emails
├── public/
│   ├── images/                        # Photos (hero, services, à-propos)
│   └── favicon/                       # Favicon multi-tailles + webmanifest
└── src/
    ├── middleware.ts                  # next-intl + auth gate
    ├── i18n/                          # next-intl routing & request
    ├── lib/
    │   ├── prisma.ts                  # Client singleton
    │   ├── auth.ts                    # NextAuth v5 (admin + client + SSO)
    │   ├── settings.ts                # Read/write table settings (cache)
    │   ├── audit.ts                   # Audit log helper
    │   ├── workflow.ts                # State machine (quote→contract→invoice)
    │   ├── utils.ts                   # cn(), formatCurrency, calculateTaxes
    │   └── services/
    │       ├── stripe.ts              # Stripe wrapper (clés via Settings)
    │       ├── email.ts               # SMTP via nodemailer
    │       ├── pdf.tsx                # PDF generation
    │       └── websocket.ts           # WS client avec reconnect
    ├── components/
    │   ├── ui/                        # shadcn primitives (20+)
    │   ├── admin/                     # Sidebar, topbar, CDP, PageHeader, StatusBadge
    │   ├── portal/                    # Sidebar, bottom nav
    │   ├── public/                    # Nav, Footer
    │   ├── signature/                 # ⭐ Canvas de signature INTERNE
    │   ├── chat/                      # ChatWidget (pop-up/bottom-sheet)
    │   └── data-table/                # DataTable réutilisable
    └── app/
        ├── layout.tsx                 # Root + metadata SEO
        ├── globals.css                # Tailwind + VNK navy theme
        ├── [locale]/
        │   ├── layout.tsx             # NextIntlClientProvider + Sonner
        │   ├── (public)/              # Site public (home, services, à-propos, contact)
        │   ├── (admin)/admin/         # Dashboard, clients, mandats, devis, factures,
        │   │                          # contrats, messages, documents, litiges,
        │   │                          # remboursements, transactions, dépenses,
        │   │                          # déclarations, calendrier, workflow, paramètres
        │   └── (portal)/portail/      # 9 onglets client
        ├── actions/                   # Server Actions (settings, workflow)
        └── api/                       # API routes (clients, mandates, quotes,
                                       # invoices, contracts, messages, documents,
                                       # calendar, contact, payments, webhooks)
```

---

## 🎨 Fonctionnalités

### Public (`/`, `/services`, `/a-propos`, `/contact`)
- Site marketing avec SEO complet (OG tags, JSON-LD, favicon)
- Formulaire de contact avec honeypot + rate limiting
- Responsive natif (mobile-first, breakpoints Tailwind)
- FR + EN via `next-intl`

### Portail client (`/portail`)
- Tableau de bord avec KPI (mandats actifs, devis en attente, factures à payer)
- Mes mandats (avec barre de progression)
- Mes demandes (remplace le parsing string "NOUVELLE DEMANDE DE PROJET")
- Mes devis (accepter/refuser avec signature canvas)
- Mes factures (paiement Stripe intégré)
- Mes contrats (signature canvas client)
- Mes documents (lecture/téléchargement)
- Réserver un appel (widget calendrier custom)
- Mes rendez-vous (reprogrammer, annuler)

### Admin (`/admin`)
- Dashboard avec KPI temps réel
- Pipeline workflow (kanban 6 colonnes : prospect → complété)
- Clients + Client Detail Panel (slide-out avec 5 onglets)
- Mandats, Devis, Factures, Contrats (DataTable avec tri, filtre, export CSV)
- Messages (dual-pane chat style)
- Documents, Litiges, Remboursements, Transactions
- Dépenses, Synthèse financière, Déclarations fiscales TPS/TVQ
- Calendrier (vue semaine + gestion des créneaux)
- **Paramètres (15 onglets)** — configure tout le site sans toucher au code

### ⭐ Section Paramètres
La pièce centrale qui permet de **tout configurer sans éditer le code** :

| Onglet | Configure |
|---|---|
| Général | Nom entreprise, slogan, langue, fuseau, devise, heures d'ouverture |
| Entreprise | NEQ, TPS, TVQ, taux, adresse légale, coordonnées, logos |
| Portail client | Catégories docs, secteurs, services, marques PLC, statuts, onglets activés |
| Facturation | Plans de paiement, numérotation, relances automatiques |
| Signature | Ordre de signature, texte légal, capture IP (canvas interne) |
| Emails | SMTP, templates, signatures |
| Intégrations | Stripe, Calendly, SSO Google, SSO Microsoft, reCAPTCHA |
| Système | Logs, sauvegardes, limites upload, rate limit |
| Utilisateurs | SSO, 2FA, politique mots de passe |
| Apparence | Couleurs, polices, logos, CSS custom |
| SEO | Meta tags, JSON-LD, OG image, robots.txt |
| Notifications | Canaux, déclencheurs, heures silencieuses |
| Légal/RGPD | Cookies, politique, rétention |
| Blog & CMS | Blog, FAQ, témoignages |
| Analytics | Tracking, dashboards |

Chaque modification est **tracée dans `audit_logs`** et appliquée en temps réel via invalidation de cache.

---

## 🔐 Signature électronique (INTERNE)

Pas de dépendance Dropbox Sign / HelloSign — canvas de signature maison.

**Flux :**
1. Client dessine dans le portail → `POST /api/contracts/:id/sign` → `contract.client_signature_data` (base64 PNG)
2. Admin dessine dans `/admin/contracts` → `contract.admin_signature_data`
3. Quand les **deux** sont présents → `contract.status = 'signed'`, `signed_at = NOW()`, `onContractFullySigned()` génère la facture automatiquement selon le plan de paiement

**Composants :**
- `src/components/signature/signature-canvas.tsx` — canvas HiDPI avec support tactile
- `src/components/signature/signature-dialog.tsx` — wrapper `<Dialog>` avec appel API

**Preuve légale :**
- IP du signataire capturée automatiquement (`client_signature_ip`)
- Horodatage via `signed_at`
- Texte légal affiché au-dessus du canvas (configurable via `settings.signature.legal_footer`)

---

## 🔁 Workflow engine (`lib/workflow.ts`)

State machine centralisée avec ~30 événements typés. Trois transitions principales :

```typescript
// 1. Client accepte un devis → génère contrat auto
await acceptQuote(quoteId, 'client');

// 2. Les 2 parties ont signé le contrat → génère 1re facture
await onContractFullySigned(contractId);

// 3. Stripe webhook payment_intent.succeeded → marque facture payée
await markInvoicePaid(invoiceId, 'stripe', paymentIntentId);
```

Chaque transition :
1. Écrit dans `workflow_events` (historique + timeline)
2. Déclenche les webhooks sortants (`outgoing_webhooks`)
3. Envoie les notifications email/push selon `settings.notifications.*`
4. Revalidate les pages Next.js concernées

---

## 🔒 Sécurité

- **NextAuth v5** protège `/admin/*` et `/portail/*` via middleware
- **Bcrypt** (12 rounds) pour les mots de passe
- **Zod** valide tous les inputs des API routes
- **Rate limiting** sur `/api/contact` (5/h par IP)
- **Honeypot** sur le formulaire de contact
- **Audit log** sur chaque action admin
- **Headers sécurité** : X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy

---

## 🌐 Internationalisation

**FR + EN** depuis le jour 1 via `next-intl`.

- Toutes les chaînes dans `messages/fr.json` + `messages/en.json` (~700 clés chacun)
- URLs préfixées : `/fr/admin`, `/en/admin`
- Détection automatique langue navigateur
- Pour ajouter une nouvelle langue : ajouter la locale dans `src/i18n/routing.ts` + créer `messages/{xx}.json`

---

## 📦 Scripts npm

```bash
npm run dev          # Dev server sur http://localhost:3000
npm run build        # Build production
npm run start        # Production server
npm run lint         # ESLint
npm run db:generate  # Génère le client Prisma
npm run db:push      # Pousse le schéma vers la DB (sans migration)
npm run db:migrate   # Applique/crée une migration versionnée
npm run db:seed      # Seed admin + 120 settings + catalogue
npm run db:studio    # UI web Prisma Studio
```

---

## 🗄️ Base de données

- **PostgreSQL** (Railway en prod, local en dev)
- **Prisma** comme ORM + générateur de client TypeScript
- **Migration initiale idempotente** à `prisma/migrations/20260411_000_init/migration.sql`
  - Utilise `CREATE TABLE IF NOT EXISTS`, `DO $$ ... EXCEPTION` pour les enums, `ALTER TABLE ADD COLUMN IF NOT EXISTS`
  - Peut être ré-exécutée sans risque sur une base qui a déjà les tables

**31 tables** au total :
- 20 tables existantes : `admins`, `clients`, `mandates`, `quotes`, `contracts`, `invoices`, `payments`, `refunds`, `disputes`, `expenses`, `tax_declarations`, `documents`, `messages`, `contact_messages`, `mandate_logs`, `workflow_events`, `ws_connections`, `page_views`, `availability_slots`, `appointments`
- 11 nouvelles tables : `settings`, `audit_logs`, `integrations`, `outgoing_webhooks`, `incoming_webhook_logs`, `notifications`, `email_templates`, `pdf_templates`, `subscription_plans`, `subscriptions`, `service_catalog`, `discount_codes`, `blog_posts`, `faq_items`, `testimonials`, `maintenance_windows`, `incident_reports`, `project_requests`, `client_team_members`, `time_entries`, `admin_sessions`

---

## 🔧 Intégrations externes

| Service | Comment activer |
|---|---|
| **Stripe** | Clés dans `.env.local` ou via Paramètres → Intégrations |
| **Gmail SMTP** | App Password dans `.env.local` `SMTP_PASSWORD` |
| **Calendly** | API key + webhook secret dans Paramètres → Intégrations |
| **Google SSO** | `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` dans `.env.local` (instructions dans `.env.example`) |
| **Microsoft SSO** | `AUTH_MICROSOFT_ENTRA_ID_*` dans `.env.local` |

Signature électronique : **pas de Dropbox Sign** — canvas interne.

---

## 📄 Licence

Propriétaire · VNK Automatisation Inc. © 2026

---

Pour toute question sur le code, voir les commentaires dans `src/lib/workflow.ts` et `src/app/[locale]/(admin)/admin/settings/settings-view.tsx` — ces deux fichiers sont la colonne vertébrale du projet.
