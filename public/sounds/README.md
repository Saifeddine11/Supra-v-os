# Sons de notification (optionnels)

Si vous ajoutez des fichiers **courts** ici, l’app les utilisera en priorité ; sinon une courte synthèse Web Audio est jouée.

Fichiers attendus (noms exacts) :

- `notification-soft.mp3`
- `notification-important.mp3`
- `notification-urgent.mp3`
- `notification-critical.mp3` (recommandé, ~3–4 s, fort)
- `notification-critical.wav` (**fourni par défaut** ~3,5 s si le MP3 est absent)

## Critique (alarme obligatoire)

L’alarme critique tente dans l’ordre :

1. `/sounds/notification-critical.mp3` à **volume 1.0**
2. sinon `/sounds/notification-critical.wav` (fichier généré dans le dépôt)
3. sinon synthèse Web Audio longue (~3,5 s)

Les membres ne peuvent pas désactiver ce son pour les alertes critiques ; le navigateur peut toutefois bloquer l’autoplay jusqu’à une interaction (clic / touche), puis le son part automatiquement.
