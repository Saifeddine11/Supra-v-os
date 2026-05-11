# Sons de notification (optionnels)

Si vous ajoutez des fichiers **courts** ici, l’app les utilisera en priorité ; sinon une courte synthèse Web Audio est jouée.

Fichiers attendus (noms exacts) :

- `notification-soft.mp3`
- `notification-important.mp3`
- `notification-urgent.mp3`
- `notification-critical.mp3` (cloche / niveau critique non obligatoire)
- `notification-critical.wav` (repli si MP3 absent)

## Bannière « alertes critiques actives » (obligatoire)

Le son **obligatoire** de la bannière (API `critical-active`) est un **ding Web Audio** très court (~0,45 s, volume ~0,22) — il ne lit plus les fichiers `notification-critical.*` longs.

Les fichiers `notification-critical.*` restent utilisés pour la **cloche** lorsqu’une notification est au niveau sonore `critical` (hors flux obligatoire bannière).

Les membres ne peuvent pas désactiver ce son obligatoire ; le navigateur peut bloquer l’autoplay jusqu’à une interaction (clic / touche), puis le son part après déblocage.
