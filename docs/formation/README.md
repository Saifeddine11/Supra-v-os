# Formation Supra v. Agency OS — livrables

| Fichier | Description |
|---------|-------------|
| `GUIDE_COMPLET_SUPRA_AGENCY_OS.md` | Manuel complet (source principale) |
| `QUICK_START_ADMIN.md` | Démarrage rapide administrateur |
| `QUICK_START_EQUIPE.md` | Démarrage rapide équipe |
| `print.css` | Feuille de style pour export PDF (noir & orange) |
| `GUIDE_COMPLET_SUPRA_AGENCY_OS.pdf` | PDF généré (après `npm run docs:pdf`) |

## Générer le PDF

Prérequis : Node 20+, **environnement où Chromium (Puppeteer) peut démarrer** (machine locale ou CI avec dépendances navigateur). Le premier lancement peut télécharger Chromium.

```bash
npm run docs:pdf
```

Le script `scripts/generate-training-pdf.mjs` appelle `md-to-pdf` avec `print.css` (A4, marges, fonds d’impression).

> Si la commande échoue avec *Failed to launch the browser process*, exécuter en local hors bac à sable restrictif, ou installer les libs système requises par Puppeteer (voir [documentation Puppeteer](https://pptr.dev/troubleshooting)).

Alternative manuelle :

```bash
npx --yes md-to-pdf docs/formation/GUIDE_COMPLET_SUPRA_AGENCY_OS.md \
  --basedir docs/formation \
  --stylesheet docs/formation/print.css \
  --pdf-options '{"format":"A4","printBackground":true,"margin":{"top":"18mm","bottom":"18mm","left":"16mm","right":"16mm"}}'
```

## Export Word (DOCX)

Si [Pandoc](https://pandoc.org/) est installé :

```bash
pandoc docs/formation/GUIDE_COMPLET_SUPRA_AGENCY_OS.md \
  -o docs/formation/GUIDE_COMPLET_SUPRA_AGENCY_OS.docx
```

Sinon : ouvrir le `.md` dans Word (**Fichier → Ouvrir**) puis enregistrer en `.docx` (mise en forme à retravailler éventuellement).
