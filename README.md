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
| *(racine)* | L'application : `index.html`, `script.js` (fiche + accueil), `auth.js` (Supabase), `calcul.js` (moteur de calcul : chaque total en sources nommées), `toasts.js` (messages sur parchemin), `charger.js` (modules chargés à la demande) + `dialogues.js` (confirmer, demander, informer), `srd-data.js` (accès aux règles + contenu personnel), `rules-page.js` (écran Règles), `homebrew.js` (éditeur de contenu personnel), `pj-tutorial.js` (assistant de création), `hero-card.js` + `hero-card-styles.js` (carte de héros à partager et ses styles), `effets.js` (effets de dés et voiles d'état), `exploits.js` + `exploits-suivi.js` + `secrets.js` + `secrets-monde.js` + `secrets-plus.js` + `secrets-absurdes.js` (trophées du compte et petits secrets)… |
| `data/srd/` | La base de règles générée — sorts, monstres, objets, équipement, classes, races, états. Voir son `README.md`. |
| `tools/srd/` | Les scripts Python qui régénèrent `data/srd/` depuis le PDF officiel. |
| `docs/` | Migration Supabase et cahier des charges en cours. |
| `lib/dice-box/` | Moteur de dés 3D, servi en local (un Web Worker ne peut pas venir d'un autre domaine). |
| `tests/` | Tests de bout en bout (Playwright), isolés : leur propre `package.json`, Supabase simulé, rien de chargé par le site. Voir `tests/LISEZMOI.md`. |

## Configuration

**Supabase** — l'URL et la clé sont en tête de `auth.js`. La clé est de type
`publishable`, prévue pour être publique : ce sont les politiques **Row Level
Security** qui protègent les données, pas la clé. Vérifie qu'elles sont actives
sur `characters` et `character_data`.

La migration `docs/Archivage et ordre des personnages.sql` est **facultative** :
sans elle, l'archivage et l'ordre des personnages restent locaux au navigateur.

## Régénérer la base de règles

La page Règles propose deux éditions, chacune tirée du PDF officiel français de
Wizards of the Coast : **2014** (SRD 5.1, `data/srd/2014/fr/`) et **2024**
(SRD 5.2.1, `data/srd/2024/fr/`). L'édition choisie vaut pour tout le site ;
sans choix enregistré, c'est la 2024.

### Édition 2024 (SRD 5.2.1)

```bash
pip install pymupdf
python tools/srd/build_2024.py
```

Le PDF est téléchargé une fois dans `tools/srd/cache/` (ou passé par `--pdf`).
Le script signale toute anomalie d'extraction par `!!` et échoue dans ce cas.

### Édition 2014 (SRD 5.1)

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

Le contenu de `data/srd/` provient du **System Reference Document 5.1** (2014) et
du **System Reference Document 5.2.1** (2024), versions françaises officielles de
Wizards of the Coast, distribués sous
[Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).
Toute redistribution doit conserver ces mentions :

> This work includes material from the System Reference Document 5.1
> ("SRD 5.1") by Wizards of the Coast LLC, licensed under the Creative Commons
> Attribution 4.0 International License.

> Cette œuvre inclut du matériel issu du System Reference Document 5.2.1
> (« SRD 5.2.1 ») de Wizards of the Coast LLC, disponible à l’adresse
> https://www.dndbeyond.com/srd. Le SRD 5.2.1 est régi par la Licence Creative
> Commons Attribution 4.0 International, disponible à l’adresse
> https://creativecommons.org/licenses/by/4.0/legalcode.

La déclaration 5.2.1 ci-dessus est recopiée **mot pour mot** de la page
« Informations légales » du PDF français officiel
(`FR_SRD_CC_v5.2.1.pdf`, celui que télécharge `tools/srd/srd52_pdf.py`) : c’est la
traduction publiée par Wizards, pas une traduction du projet. Le même document
demande de **n’ajouter aucune autre attribution** à Wizards of the Coast, tout en
autorisant la mention « compatible avec la cinquième édition ».

Le site l’affiche sous chaque fiche de règle, au pied de la page Règles, dans les
mentions légales et sur l’impression (`edition.js`, seul endroit où ce texte est
écrit).

Ce projet n'est **pas** un produit officiel Dungeons & Dragons et n'est ni
approuvé ni soutenu par Wizards of the Coast.

Le code de l'application n'a pas encore de licence explicite — sans mention, il
reste sous droit d'auteur exclusif. Ajoute un fichier `LICENSE` (MIT par
exemple) si tu souhaites autoriser sa réutilisation.
