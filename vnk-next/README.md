# VNK Automatisation — Next.js migration

Version Next.js 15 du site, portail client et dashboard admin VNK. Cette
refonte vit à côté de l'Express/HTML existant (`../backend` + `../frontend`)
pour permettre une migration progressive section par section sans casser le
site en production.

## 🎯 Ce qui change (pourquoi cette migration)

La version HTML/Express historique souffrait de :

- **10+ routes sans authentification** (`POST /api/clients`, `POST /api/quotes`, etc.)
- **~40 `ALTER TABLE IF NOT EXISTS` dispersés** dans les fichiers de routes
- **~1 400 lignes de code mort** (4 paires de `renderX` dupliquées dans `portal.js`)
- **`chat-widget.js` = doublon exact de `portal.js`** (6560 lignes chaque)
- **434 `!important`** dans `main.css`
- **0 `aria-label`** dans le portail, **0 `role="dialog"`** sur les 17 modales
- **Breakpoints responsive incohérents** (7 valeurs différentes, gap 768-900 px cassé)
- **Pas de section Paramètres** (tout est hardcodé dans le code)
- **Pas d'OG/JSON-LD/favicon** sur les pages publiques

La version Next.js règle ~85 % de ces problèmes **par l'architecture** (et
non à la main, fix par fix). Les composants sont réutilisables, Prisma gère
les migrations versionnées, NextAuth sécurise toutes les routes via un seul
middleware, shadcn/ui apporte l'accessibilité native, Tailwind élimine la
guerre des spécificités CSS.

## 🏗️ Architecture

```
vnk-next/
├── prisma/
│   ├── schema.prisma          # 30+ modèles (20 existants + 11 nouveaux)
│   ├── migrations/            # Migrations versionnées (remplace les 40 ALTER scattered)
│   └── seed.ts                # Admin + ~120 settings par défaut + service catalog
├── messages/
│   ├── fr.json                # ~700 clés i18n français (source de vérité)
│   └── en.json                # Traductions anglaises
├── src/
│   ├── middleware.ts          # next-intl routing + auth gate sur /admin et /portail
│   ├── i18n/
│   │   ├── routing.ts         # fr + en, prefix always
│   │   └── request.ts         # Loader des messages + timezone Montréal
│   ├── lib/
│   │   ├── prisma.ts          # Client singleton (safe pour HMR)
│   │   ├── auth.ts            # NextAuth v5 : admin-credentials + client-credentials + Google + Microsoft
│   │   ├── settings.ts        # Read/write helpers avec cache mémoire
│   │   ├── audit.ts           # Log des actions admin (never throws)
│   │   ├── workflow.ts        # ⭐ State machine : acceptQuote, onContractFullySigned, markInvoicePaid
│   │   ├── utils.ts           # cn(), formatCurrency, calculateTaxes, generateDocumentNumber
│   │   └── services/
│   │       ├── stripe.ts      # createPaymentIntent, refundPayment, verifyWebhookSignature
│   │       ├── email.ts       # SMTP + render templates
│   │       └── dropbox-sign.ts # sendSignatureRequest, verify webhook
│   ├── components/
│   │   ├── ui/                # shadcn primitives (Button, Card, Dialog, Tabs, ...)
│   │   ├── admin/             # Sidebar, Topbar
│   │   ├── portal/            # Sidebar, bottom nav
│   │   ├── public/            # Nav, Footer
│   │   ├── chat/
│   │   │   └── chat-widget.tsx # ⭐ Refactor complet de chat-widget.js (300 lignes vs 6560)
│   │   └── data-table/
│   │       └── data-table.tsx # ⭐ Composant unique qui remplace les 12+ versions de renderX
│   └── app/
│       ├── layout.tsx         # Root : metadata, Inter font, favicon
│       ├── globals.css        # Tailwind + shadcn CSS vars + VNK navy palette
│       ├── [locale]/
│       │   ├── layout.tsx     # NextIntlClientProvider + Sonner
│       │   ├── (public)/
│       │   │   ├── layout.tsx # Nav + footer publics
│       │   │   ├── page.tsx   # / Home avec hero, services, CTA
│       │   │   ├── services/page.tsx
│       │   │   ├── a-propos/page.tsx
│       │   │   └── contact/
│       │   │       ├── page.tsx
│       │   │       └── contact-form.tsx  # Avec honeypot + rate limit côté API
│       │   ├── (admin)/
│       │   │   └── admin/
│       │   │       ├── layout.tsx         # Sidebar + topbar + auth gate
│       │   │       ├── login/page.tsx     # Login admin
│       │   │       ├── page.tsx           # Dashboard KPI + activité
│       │   │       └── settings/
│       │   │           ├── page.tsx       # ⭐ Section Paramètres (15 onglets cards)
│       │   │           └── settings-view.tsx
│       │   └── (portal)/
│       │       └── portail/
│       │           ├── layout.tsx
│       │           ├── login/page.tsx
│       │           └── page.tsx
│       ├── actions/
│       │   └── settings.ts     # Server Actions (updateSettings, testConnection)
│       └── api/
│           ├── auth/[...nextauth]/route.ts
│           ├── clients/route.ts           # GET, POST avec Zod validation + audit
│           ├── clients/[id]/route.ts      # GET, PATCH, DELETE (soft archive)
│           ├── mandates/route.ts
│           ├── quotes/route.ts            # Lit les taux TPS/TVQ depuis Settings
│           ├── quotes/[id]/accept/route.ts # → delegates to workflow.acceptQuote
│           ├── invoices/route.ts
│           ├── contracts/route.ts
│           ├── documents/route.ts
│           ├── messages/route.ts
│           ├── calendar/available/route.ts
│           ├── calendar/book/route.ts     # Transaction atomique slot + appointment
│           ├── contact/route.ts           # Public, honeypot + rate limit 5/h par IP
│           └── webhooks/
│               └── stripe/route.ts        # Log incoming + dispatch workflow events
```

## 🚀 Démarrage

### Prérequis

- Node.js ≥ 18 (testé sur v25.8)
- PostgreSQL ≥ 14 (même instance que l'Express existant — les deux stacks partagent la DB)
- npm ≥ 10

### Installation

```bash
# Depuis la racine du repo
cd vnk-next
npm install
```

### Configuration

```bash
cp .env.example .env.local
# Édite .env.local avec :
# - DATABASE_URL (pointe vers la même DB que l'Express actuel)
# - AUTH_SECRET (générer avec : openssl rand -base64 32)
# - Stripe, SMTP, Dropbox Sign — tous optionnels (configurable via Paramètres)
```

### Base de données

Deux scénarios :

**Scénario A — Nouvelle base** (fresh install) :

```bash
npm run db:migrate    # Applique prisma/migrations/20260411_000_init
npm run db:seed       # Crée admin + 120 settings + service catalog
```

**Scénario B — Base existante de l'Express** (migration douce) :

La migration initiale est compatible avec le schéma existant de `backend/database/schema.sql`.
Les tables existent déjà. Il suffit de :

```bash
npm run db:generate   # Génère le client Prisma
# Les nouvelles tables (settings, audit_logs, etc.) seront créées à la première requête
# ou via : npm run db:push
npm run db:seed       # Charge les 120 settings par défaut
```

### Démarrage en dev

```bash
npm run dev
# → http://localhost:3001
```

L'Express existant continue de tourner sur `:3000` en parallèle pour les
sections pas encore migrées. Pendant la transition, on peut ajouter un
`rewrite` dans `next.config.ts` pour proxy les routes non migrées vers
l'Express.

### Compte admin par défaut

```
Courriel : vnkautomatisation@gmail.com
Mot de passe : AdminVNK2026!
```

**⚠️ À changer immédiatement après la première connexion** via
`/fr/admin/settings` → onglet Utilisateurs.

## 🎨 Pièce centrale : la section Paramètres

Le point d'entrée de la migration est `/fr/admin/settings`. Elle contient
**15 onglets** en cartes style VNK :

| Onglet | Contenu |
|---|---|
| **Général** | Nom entreprise, slogan, langue, fuseau horaire, devise, heures d'ouverture |
| **Entreprise** | NEQ, TPS, TVQ, taux, adresse, coordonnées, logo |
| **Portail client** | Catégories de documents, secteurs, services, marques PLC, statuts, toggles tabs |
| **Facturation** | Plans de paiement, conditions, délais, numérotation, relances auto |
| **Signature** | Provider, ordre de signature, texte légal, expiration |
| **Emails** | SMTP, templates, signatures, CCI admin |
| **Intégrations** | Stripe, Dropbox Sign, Calendly, Google, Microsoft, reCAPTCHA |
| **Système** | Logs, sauvegardes, limites upload, JWT session, rate limit |
| **Utilisateurs** | SSO, 2FA, politique mots de passe, verrouillage |
| **Apparence** | Couleurs (primary, success, warning), polices, logos, CSS custom |
| **SEO** | Meta tags, JSON-LD, OG image, robots.txt |
| **Notifications** | Canaux, déclencheurs, heures silencieuses |
| **Légal/RGPD** | Cookies, politique, rétention, export RGPD |
| **Blog** | Activer blog, catégories, articles par page |
| **Analytics** | Tracking, période KPI |

**Chaque champ lit/écrit la table `settings` via `lib/settings.ts`**. Les
valeurs sont mises en cache mémoire 60 s puis invalidées automatiquement
après chaque modification. Toutes les modifications sont tracées dans
`audit_logs`.

## 🔁 Workflow engine (state machine)

Le fichier `lib/workflow.ts` centralise les transitions métier critiques :

| Transition | Fonction | Effet |
|---|---|---|
| Client accepte un devis | `acceptQuote(quoteId)` | Quote → accepted, génère contrat CT-YYYY-### auto |
| Contrat signé par les 2 parties | `onContractFullySigned(contractId)` | Génère F-YYYY-### acompte ou solde selon le plan |
| Stripe webhook paiement | `markInvoicePaid(invoiceId, method)` | Invoice → paid, crée Payment, émet événement |

Chaque événement déclenche :
1. Une ligne dans `workflow_events` (historique)
2. Une invalidation du cache des KPIs
3. L'envoi asynchrone des webhooks sortants (`outgoing_webhooks`)
4. Les notifications email/push selon `settings.notifications.*`

## 🔒 Sécurité

- **NextAuth v5** : tous les endpoints `/admin/*` et `/portail/*` sont
  gatés par le middleware (`src/middleware.ts`)
- **Routes API** : chaque handler commence par `await auth()` + check de rôle
- **Bcrypt** pour les mots de passe (12 rounds)
- **Zod** valide tous les inputs (body, query, params) avant la DB
- **Rate limiting** sur `/api/contact` (5/h par IP)
- **Honeypot** sur le formulaire de contact
- **Audit log** sur chaque action admin (create/update/delete/login/logout/settings_update)
- **Headers sécurité** dans `next.config.ts` (X-Frame-Options, X-Content-Type-Options, Referrer-Policy)

## 🌐 Internationalisation

- **fr + en** depuis le jour 1 via `next-intl`
- Toutes les chaînes sont dans `messages/fr.json` + `messages/en.json`
- URLs préfixées : `/fr/admin/settings`, `/en/admin/settings`
- Détection automatique de la langue navigateur
- Nouvelles langues : ajouter une locale dans `routing.ts` + créer le fichier `messages/{xx}.json`

## 📦 Composants réutilisables clés

### `<DataTable>`

Le composant unique qui remplace les 12+ versions de `renderX` du `portal.js`
et `admin.html`. Il fournit tri / recherche / filtres / pagination /
sélection / export CSV / mode cards mobile / accessibilité complète.

```tsx
<DataTable
  data={invoices}
  columns={[
    { key: "number", header: "Numéro", accessor: (r) => r.invoiceNumber, sortable: true },
    { key: "client", header: "Client", accessor: (r) => r.client.fullName },
    { key: "amount", header: "Montant", accessor: (r) => formatCurrency(r.amountTtc), sortable: true },
  ]}
  getRowId={(r) => r.id}
  exportFilename="factures"
  renderCard={(r) => <InvoiceCard invoice={r} />}
/>
```

### `<ChatWidget>`

Refactor complet de `chat-widget.js` (6560 lignes → 300 lignes). Pop-up
desktop / bottom-sheet mobile, WebSocket + polling fallback,
`role="dialog"`, focus trap, `aria-live`, upload fichier.

## 🧪 Scripts npm

```bash
npm run dev          # Démarre Next.js en mode dev sur :3001
npm run build        # Build production
npm run start        # Démarre le build production
npm run lint         # ESLint
npm run db:generate  # Génère le client Prisma depuis schema.prisma
npm run db:push      # Push le schema vers la DB (sans migration)
npm run db:migrate   # Applique/crée une migration
npm run db:seed      # Lance prisma/seed.ts
npm run db:studio    # Ouvre Prisma Studio
```

## 🚧 État de la migration

**✅ Fait**
- Setup complet : Next.js 15 + Prisma + NextAuth v5 + shadcn/ui + Tailwind + next-intl
- Schéma Prisma : 20 tables existantes + 11 nouvelles
- Migration SQL initiale versionnée (remplace les 40 ALTER TABLE scattered)
- Seed : admin + 120 settings + service catalog
- i18n FR + EN (~700 clés)
- NextAuth v5 avec credentials admin + client + Google + Microsoft (stubs)
- 20+ primitives shadcn/ui rebuildées avec palette VNK navy
- Workflow engine avec 3 transitions principales + HMAC webhooks
- Pages admin : layout avec sidebar/topbar/mobile drawer, login, dashboard KPI, **section Paramètres complète (15 onglets)**
- Pages portal : layout avec sidebar + bottom-nav mobile, login, dashboard
- Pages publiques : home avec hero/services/CTA, services, à-propos, contact (form avec honeypot)
- Routes API : clients, mandates, quotes (+ accept), invoices, contracts, documents, messages, calendar (available + book), contact, webhooks Stripe
- Composants transverses : ChatWidget, DataTable

**🔨 À finir (ordre recommandé)**

1. Brancher Prisma client après `npm install` (vérifier que `npm run db:generate` passe)
2. Client Detail Panel admin (slide-out droite)
3. Pages admin : Clients/Mandats/Devis/Factures/Contrats/Documents/Messages (utiliser `<DataTable>`)
4. Pages portal : Mandats/Devis/Factures/Contrats/Documents/RDV (utiliser `<DataTable>`)
5. PDF generation (`@react-pdf/renderer` ou rester sur PDFKit via API proxy)
6. Socket.io server pour chat temps réel
7. Modales admin : new-client, new-mandate, new-quote, new-invoice, new-contract, new-expense
8. Calendrier admin (vue semaine/mois, CRUD slots)
9. Email templates (en DB : seed + UI d'édition)
10. Migration des données client existantes (script SQL si besoin)
11. Cutover : pointer `vnk-website-production.up.railway.app` sur le build Next.js, retirer Express

## 🏃 Plan de migration progressif

**Semaine 1** — Setup + section Paramètres (✅ fait)

**Semaine 2** — Pages publiques + auth (public en live, admin/portail continue sur Express)

**Semaines 3-4** — Portail client (10 onglets) — active les nouvelles pages sous `/fr/portail` pendant que `/portail.html` existant coexiste via rewrite

**Semaines 5-7** — Admin dashboard (18 sections) — idem

**Semaine 8** — Retrait définitif de l'Express, cleanup des anciens fichiers `frontend/` + `backend/`

## 📝 Notes importantes

- Le thème VNK navy `#0F2D52` est défini en CSS vars + Tailwind custom
- Les modales utilisent shadcn `<Dialog>` (focus trap + Escape intégré)
- Tous les `<DataTable>` ont pagination par défaut 10 lignes (configurable)
- Le chat widget est monté automatiquement dans les layouts admin et portal
- Les SVG icons viennent de `lucide-react` — jamais d'emoji dans l'UI (règle VNK)
- Français = source de vérité pour les messages, anglais = traduction
- Les changements de settings sont instantanés (cache invalidé + `revalidatePath`)

---

Pour toute question pendant la migration, ouvre une issue sur le repo
ou consulte les commits tagués `feat(vnk-next)` pour voir la progression.
