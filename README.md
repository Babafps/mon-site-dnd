# Bones & Blades

Application web de fiches de personnage pour Dungeons & Dragons 5e, avec base de
règles française intégrée. Compatible avec la 5<sup>e</sup> édition.

Application monopage en **JavaScript/CSS/HTML pur — aucun build, aucun npm**,
installable comme PWA. Comptes et synchronisation par Supabase.

## Lancer en local

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Puis ouvrir <http://localhost:8123/>.

Un double-clic sur `index.html` ne suffit pas : en ouverture fichier (`file://`),
les modules ES ne se chargent pas et les dés 3D comme la base de règles restent
inertes.

## Ce que contient le projet

| Dossier | Contenu |
|---|---|
| *(racine)* | L'application : `index.html`, `script.js` (fiche + accueil), `auth.js` (Supabase), `session.js` (temps réel joueur), `gm-screen.js` (écran MJ), `srd-data.js` (accès aux règles)… |
| `data/srd/` | La base de règles générée — sorts, monstres, objets, équipement, classes, races, états. Voir son `README.md`. |
| `tools/srd/` | Les scripts Python qui régénèrent `data/srd/` depuis le PDF officiel. |
| `docs/` | Migration Supabase et cahier des charges en cours. |
| `lib/dice-box/` | Moteur de dés 3D, servi en local (un Web Worker ne peut pas venir d'un autre domaine). |

## Configuration

**Supabase** — l'URL et la clé sont en tête de `auth.js`. La clé est de type
`publishable`, prévue pour être publique : ce sont les politiques **Row Level
Security** qui protègent les données, pas la clé. Vérifie qu'elles sont actives
sur `characters`, `character_data` et les tables de session.

La migration `docs/Archivage et ordre des personnages.sql` est **facultative** :
sans elle, l'archivage et l'ordre des personnages restent locaux au navigateur.

**Interface Maître du Jeu** — désactivée par défaut. Un seul interrupteur, en
tête d'`index.html` :

```js
window.GM_ENABLED = false;   // true = onglet MJ + chargement de gm-screen.js/css
```

À `false`, les 508 Ko de l'écran MJ ne sont même pas téléchargés.

## Régénérer la base de règles

```bash
cd tools/srd
python extract_lines.py     # PDF officiel -> lines.jsonl
python build_spells.py      # puis monsters, items, equipment, conditions, rules, chars
python build_index.py       # index de recherche
```

Les scripts retéléchargent seuls le PDF et les données de référence. Chacun
**valide sa sortie** et signale titres non localisés, appariements ambigus et
incohérences. Détails dans `data/srd/README.md`.

## Licence et attribution

Le contenu de `data/srd/` provient du **System Reference Document 5.1**, version
française officielle de Wizards of the Coast, distribué sous
[Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).
Toute redistribution doit conserver cette mention :

> This work includes material from the System Reference Document 5.1
> ("SRD 5.1") by Wizards of the Coast LLC, licensed under the Creative Commons
> Attribution 4.0 International License.

Ce projet n'est **pas** un produit officiel Dungeons & Dragons et n'est ni
approuvé ni soutenu par Wizards of the Coast.

Le code de l'application n'a pas encore de licence explicite — sans mention, il
reste sous droit d'auteur exclusif. Ajoute un fichier `LICENSE` (MIT par
exemple) si tu souhaites autoriser sa réutilisation.
