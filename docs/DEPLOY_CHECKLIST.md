# Checklist de déploiement — v1.1 features

Toutes les nouvelles fonctionnalités utilisateur sont implémentées. Cette checklist liste les actions de déploiement à exécuter.

## 1. Régénérer Prisma client

Indispensable — sinon les nouveaux models (Team, AdminPasskey, WebAuthnChallenge, PasswordResetToken) ne sont pas typés.

```bash
# Arrêter le dev server d'abord (Ctrl+C)
npx prisma generate
```

## 2. Migration BD (additive — aucune perte de données)

```bash
# Dev local
npx prisma migrate dev --name v1_1_features

# Prod (Railway)
npx prisma migrate deploy
```

Nouveaux objets créés :
- Table `password_reset_tokens` (déjà existante depuis la phase précédente)
- Table `admin_passkeys`
- Table `webauthn_challenges`
- Table `teams`
- Colonnes `admins.team_id`, `admins.manager_id` (nullable, donc additif)

## 3. Variables d'environnement à ajouter

### Obligatoires si tu actives la fonctionnalité

| Variable | Pour quoi |
|---|---|
| `CRON_SECRET` | Bearer token pour `/api/cron/audit-retention` |
| `INVITE_EMAIL_DOMAIN` | Whitelist domaine email (ex: `vnkautomatisation.ca`) |
| `SCIM_BEARER_TOKEN` | Token SCIM (à fournir à Azure AD / Okta) |

### Optionnelles

| Variable | Pour quoi |
|---|---|
| `SLACK_SECURITY_WEBHOOK_URL` | Webhook Slack pour events critiques |
| `TEAMS_SECURITY_WEBHOOK_URL` | Webhook Teams |
| `SECURITY_WEBHOOK_URL` | Webhook générique (JSON) |
| `AUTH_MICROSOFT_ENTRA_ID_ID` + `_SECRET` + `_ISSUER` | SSO Microsoft Entra |
| `AUTH_GOOGLE_ID` + `_SECRET` | SSO Google |
| `STORAGE_BACKEND` | `r2` / `s3` / `local` (défaut: `local` — base64 en BD) |
| `STORAGE_BUCKET` | Nom du bucket |
| `STORAGE_REGION` | Région (`auto` pour R2, `us-east-1` pour S3) |
| `STORAGE_ENDPOINT` | Endpoint R2 uniquement |
| `STORAGE_PUBLIC_BASE_URL` | URL CDN publique (sinon URL directe bucket) |
| `STORAGE_ACCESS_KEY_ID` | Clé S3/R2 |
| `STORAGE_SECRET_ACCESS_KEY` | Secret S3/R2 |

## 4. Cron Railway

Configurer un cron job journalier (heure tranquille) qui appelle :

```
POST https://vnkautomatisation.ca/api/cron/audit-retention
Authorization: Bearer ${CRON_SECRET}
```

Suggestion : 3h du matin UTC. Le job purge :
- AuditLog > 2 ans (sauf catégories permanentes Loi 25)
- AdminSecurityEvent > 2 ans (sauf criticals)
- LoginEvent > 2 ans
- PasswordResetToken usés/expirés > 30 jours
- AdminInvitation expirées/révoquées > 90 jours

GET sur le même endpoint = dry-run (renvoie le compte sans rien supprimer).

## 5. SCIM provisioning (optionnel)

URL de base : `https://vnkautomatisation.ca/api/scim/v2`

Auth : Bearer `${SCIM_BEARER_TOKEN}`

Endpoints supportés :
- `GET /Users` — liste (filter `userName eq "x@y.com"`)
- `POST /Users` — créer
- `GET /Users/{id}`
- `PUT /Users/{id}` — full update
- `PATCH /Users/{id}` — PatchOp (Azure AD utilise principalement ça)
- `DELETE /Users/{id}` — désactivation logique
- `GET /ServiceProviderConfig`

## 6. Webhooks Slack/Teams (optionnel)

**Slack** :
1. https://api.slack.com/messaging/webhooks → "Create New Webhook"
2. Copier l'URL et la mettre dans `SLACK_SECURITY_WEBHOOK_URL`

**Teams** :
1. Channel → Connecteurs → Incoming Webhook → Configure
2. Copier l'URL dans `TEAMS_SECURITY_WEBHOOK_URL`

Events qui déclenchent une notification :
- Sévérité `critical` (tout type)
- Types sensibles avec sévérité `warning` : `suspicious_login`, `password_breach_detected`, `all_sessions_revoked`, `account_deletion_requested`, `two_factor_disabled`, `api_token_created`, `trusted_device_added`, `user_deleted`

## 7. PWA installable

Aucune config requise — le manifest et le SW sont auto-chargés en prod. Test :
1. Ouvrir le site sur Chrome/Edge mobile ou desktop
2. Menu → "Installer VNK Automatisation"
3. Vérifier l'icône et les raccourcis (Tableau de bord, Requêtes, Messages, Calendrier)

## 8. Lancer les tests

```bash
npm test
```

Devrait afficher 11/11 tests qui passent (escapeHtml, magic bytes, rate-limit, WebAuthn helpers, SCIM auth).

## 9. Smoke tests à faire après déploiement

- [ ] Login admin standard (avec/sans 2FA)
- [ ] Login SSO Microsoft si configuré
- [ ] Login par passkey (enregistrer une passkey via `/admin/settings/security`, puis se déconnecter et se reconnecter via passkey)
- [ ] Upload avatar → vérifier qu'il est servi depuis R2 si configuré (regarder l'URL dans l'inspecteur)
- [ ] Inviter un user → recevoir email → activer compte avec checkbox politiques
- [ ] Désactiver un user avec successeur → vérifier transfert TimeEntries
- [ ] Export annuaire PDF
- [ ] SCIM `curl` test (si configuré)
- [ ] Cron dry-run : `GET /api/cron/audit-retention` avec bearer
- [ ] Notification cloche après désactivation 2FA sur son propre compte
