# Codex des Essences — Minewind

Site statique (HTML/CSS/JS vanilla, **sans build**). Il suffit d'ouvrir
`index.html` ou de servir le dossier tel quel.

## Structure

```
minewind-site/
├─ index.html              Page unique : charge les CSS puis les JS dans l'ordre
├─ assets/
│  ├─ css/                 Feuilles de style découpées par responsabilité
│  │  ├─ base.css            tokens (variables), thèmes clair/sombre, reset, layout, icônes
│  │  ├─ chrome.css          bouton thème, sélecteur de langue, hero, onglets, footer
│  │  ├─ codex.css           onglet Codex : recherche, légende, boutons aléatoires, cartes
│  │  ├─ build.css           onglet Équipement : sets, slots, âmes, liste d'achat
│  │  └─ responsive.css      media queries + préférences de mouvement (chargé en dernier)
│  └─ js/
│     ├─ data.js            données des essences (généré — ne pas éditer à la main)
│     ├─ i18n/              traductions de l'interface, un fichier par langue
│     │  ├─ fr.js · en.js · de.js · es.js · it.js   alimentent window.__I18N_STRINGS__
│     │  └─ index.js        assemble window.__I18N__ (à charger après les langues)
│     ├─ codex.js           logique de l'onglet Codex (recherche, cartes, thème, guide)
│     └─ build.js           logique de l'onglet Équipement (sets, slots, liste d'achat)
└─ csv/                     sources brutes (prix, alias, descriptions) ayant servi à data.js
```

## Ordre de chargement

Les fichiers sont de simples `<script>`/`<link>` (pas d'ES modules, pour
fonctionner aussi en `file://`). L'ordre dans `index.html` compte :

- **CSS** : `base → chrome → codex → build → responsive` (cascade).
- **JS** : `data` puis les langues `i18n/*` puis `i18n/index` puis `codex` et `build`.

## Cache busting

Les URLs des assets portent un suffixe `?v=AAAAMMJJx`. Incrémente-le quand tu
modifies un fichier pour forcer le rechargement côté navigateur.
