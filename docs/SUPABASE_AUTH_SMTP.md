# Supabase Auth — e-mails d’invitation et réinitialisation

## Pourquoi « email rate limit exceeded » ?

Les e-mails **Auth** (invitation, magic link, réinitialisation mot de passe) sont envoyés par **Supabase Auth**, pas par l’API Resend de l’application (`RESEND_API_KEY` dans Vercel).

Sans **SMTP personnalisé**, Supabase utilise son service d’envoi intégré, soumis à des **quotas stricts** (quelques e-mails par heure selon le plan). En test répété depuis le dashboard ou l’app, vous voyez :

`Failed to send magic link: email rate limit exceeded`

Les crons / notifications métier (rappels, factures) passent par **Resend** (`src/lib/email/send-email.ts`) et ne partagent pas ce quota Auth.

## Flux dans Supra v. Agency OS

| Flux | Mécanisme | Redirect |
|------|-----------|----------|
| Invitation collaborateur | `inviteUserByEmail` (service role) | `NEXT_PUBLIC_APP_URL` → `/auth/callback?next=/change-password` |
| Réinitialisation mot de passe | `resetPasswordForEmail` | idem |
| Mot de passe temporaire | `createUser` admin (pas d’e-mail Auth) | Connexion manuelle sur `/login` |

Code : `src/lib/employees/auth-provision.ts`

## Configurer Resend comme SMTP Supabase (recommandé)

1. **Resend** : domaine vérifié (SPF + DKIM), clé API `re_…`.
2. **Supabase Dashboard** → **Project Settings** → **Authentication** → **SMTP Settings** :
   - Enable custom SMTP : **ON**
   - Host : `smtp.resend.com`
   - Port : `465` (SSL) ou `587` (TLS)
   - Username : `resend`
   - Password : votre clé API Resend (`re_…`)
   - Sender email : adresse du domaine vérifié (ex. `notifications@app.suprav3.com`)
   - Sender name : `Supra v.`
3. **Authentication** → **URL Configuration** :
   - Site URL : `https://app.suprav3.com`
   - Redirect URLs : `https://app.suprav3.com/**`, previews Vercel, `http://localhost:3000/**`
4. **Vercel** (Production) : `NEXT_PUBLIC_APP_URL=https://app.suprav3.com` (sans slash final).
5. **Email Templates** : coller les modèles depuis `supabase/email-templates/` (voir `INSTRUCTIONS.txt`).

## En cas de limite atteinte

- Attendre le délai de quota ou activer le SMTP ci-dessus.
- Côté app **Équipe** : utiliser **« Créer un compte avec mot de passe temporaire »** (pas d’e-mail Supabase).
- Message UI : *« Limite d’envoi d’e-mails atteinte. Réessayez plus tard ou utilisez la création de mot de passe temporaire. »*

## Variables Vercel (rappel)

| Variable | Usage |
|----------|--------|
| `RESEND_API_KEY` | Crons + notifications app (pas Auth par défaut) |
| `EMAIL_FROM` | Expéditeur Resend app |
| `NEXT_PUBLIC_APP_URL` | `redirectTo` Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Invitations / création compte admin |

Ne pas confondre **Resend pour l’app** et **SMTP Resend dans Supabase Auth** : les deux utilisent la même clé Resend mais se configurent à des endroits différents.
