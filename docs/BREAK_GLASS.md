# Procédure d'urgence — Break-glass admin

> ⚠️ À utiliser **uniquement** si tous les super-admins sont verrouillés, ont perdu leur 2FA, ou ne peuvent plus se connecter.

Cette procédure permet de réactiver/réinitialiser un compte super-administrateur via un accès direct à la base de données, sans passer par le portail (donc sans 2FA).

## Prérequis

- Accès console Railway (`railway shell` ou `railway run`) **OU** tunnel direct vers Postgres prod
- Variables d'environnement chargées (`.env`)
- Node 18+ installé

## Actions disponibles

```bash
# Lister tous les super-admins (statut, 2FA, verrouillage)
node scripts/break-glass-admin.mjs --list-super-admins

# Déverrouiller un compte (failed login attempts reset, isActive=true)
node scripts/break-glass-admin.mjs --email admin@vnk.ca --action unlock

# Réinitialiser le mot de passe (min 12 caractères)
node scripts/break-glass-admin.mjs --email admin@vnk.ca --action reset-password --password "NouveauMdp12!"

# Désactiver la 2FA (en cas de téléphone/clé perdus)
node scripts/break-glass-admin.mjs --email admin@vnk.ca --action disable-2fa

# Promouvoir un compte existant en super_admin
node scripts/break-glass-admin.mjs --email admin@vnk.ca --action promote-super-admin
```

## Sécurité

- Chaque action demande une confirmation explicite (`JE CONFIRME`).
- Toutes les actions sont tracées dans `audit_logs` (`admin_break_glass`) et `admin_security_events` (sévérité critique).
- Le webhook Slack/Teams configuré recevra une notification.
- Les sessions actives sont invalidées immédiatement.

## Après une intervention

1. **Communiquer** le nouveau mot de passe via un canal sécurisé (Signal, 1Password partagé, **pas par email**).
2. L'utilisateur doit **changer son mot de passe** à la prochaine connexion via `/admin/settings/security`.
3. **Réactiver la 2FA** immédiatement après la reconnexion.
4. Vérifier le journal d'audit pour confirmer qu'il n'y a pas d'autres anomalies.

## Pour ne plus en avoir besoin

- Maintenir au moins **2 comptes super-admin actifs avec 2FA**.
- Conserver les codes de sauvegarde 2FA dans un coffre-fort partagé (1Password / Bitwarden).
- Documenter un `recoveryEmail` à jour pour chaque super-admin.
