# CLAUDE.md — Codex des Essences (Minewind)

Site **statique** vanilla (HTML/CSS/JS), **sans build, sans framework, sans
dépendances**. On ouvre `index.html` directement (compatible `file://`) ou on
sert le dossier. Pas d'étape de compilation.

## Structure

- `index.html` — page unique. Charge les CSS puis les JS **dans un ordre qui
  compte** (voir plus bas).
- `assets/css/` — styles découpés par responsabilité :
  - `base.css` : variables (`:root`), thèmes clair/sombre, reset, layout, icônes
  - `chrome.css` : bouton thème, sélecteur de langue, hero, onglets, footer
  - `codex.css` : onglet Codex (recherche, légende, boutons aléatoires, cartes)
  - `build.css` : onglet Équipement (sets, slots, âmes, liste d'achat)
  - `inventory.css` : onglet Inventaire (essences possédées en jeu)
  - `responsive.css` : media queries + reduced-motion — **chargé en dernier**
- `assets/js/`
  - `data.js` : données des essences. **Généré** — ne pas éditer à la main.
  - `i18n/{fr,en,de,es,it}.js` : chaînes d'UI, une langue par fichier ; chacune
    remplit `window.__I18N_STRINGS__[code]`.
  - `i18n/index.js` : assemble `window.__I18N__` ; **se charge après** les langues.
  - `esspicker.js` : combobox autocomplete stylé partagé, branché sur tout
    `<input data-esspick>` (remplace le `<datalist>` natif non stylable).
    Expose `window.EssPicker.filters` pour des filtres de candidats par input ;
    `build.js` y enregistre `filters.build` (essences éligibles à un slot).
  - `codex.js` : logique onglet Codex (recherche, cartes, thème, guide, langue).
  - `build.js` : logique onglet Équipement (sets multiples, slots, liste d'achat).
    Gère aussi la barre d'onglets globale (Codex/Équipement/Inventaire/Trade/Mod).
  - `inventory.js` : onglet Inventaire (essences possédées en jeu, quantités,
    valeur estimée). Persiste `minewind-inventory` et émet `invchange`, que
    `build.js` écoute pour le badge « dans ton inventaire » de la liste d'achat.
  - `firebase-init.js` : init Firebase (compat SDK) + App Check ; expose
    `window.__FB__`. `null` si le SDK CDN est bloqué.
  - `trade.js` : onglet Marché (gate de vérification, formulaire de vente,
    annonces, expiration). Expose `window.__TRADE__` (état + helpers partagés).
  - `trade-mod.js` : onglet Modération (rendu du panneau, abonnements admin,
    actions valider/rejeter, ban/déban, gestion des modos owner-only). Lit et
    complète `window.__TRADE__` ; **se charge après** `trade.js`.
- `csv/` : sources brutes (`prices`, `aliases`, `explanations`) ayant servi à
  produire `data.js`.
- `README.md` : doc utilisateur de la structure.

## Conventions

- **Scripts en globals, pas d'ES modules.** Chaque JS est une IIFE qui lit/écrit
  des globals (`window.__MINEWIND_DATA__`, `window.__I18N__`). Garder des
  `<script>` classiques pour rester compatible `file://`. Ne pas introduire
  `import`/`export` sans passer le site sous serveur HTTP.
- **i18n** : seules les chaînes d'interface sont traduites. Les noms/descriptions
  d'essences restent tels quels. Les valeurs de légende sont stockées en français
  dans `data.js` ; chaque langue fournit `orLess` / `notTraded` pour traduire les
  fragments. `codex.js` et `build.js` partagent l'état de langue via l'événement
  `codexlang`.
- **Cache-busting** : les URLs d'assets portent `?v=AAAAMMJJx`. Incrémenter ce
  suffixe (dans `index.html`) à chaque modif d'un fichier pour forcer le
  rechargement navigateur.
- **Persistance** : `localStorage` (`minewind-theme`, `minewind-lang`,
  `minewind-tab`, `minewind-builds`, `minewind-inventory`). `build.js` migre l'ancien format
  `minewind-build` → `minewind-builds`.

## Ordre de chargement (à préserver)

- CSS : `base → chrome → codex → build → trade → inventory → responsive`.
- JS : `data → i18n/{langues} → i18n/index → esspicker → codex → build →
  inventory → firebase-init → trade → trade-mod`. `esspicker.js` **doit** venir
  avant `build.js` (qui enregistre son filtre via `window.EssPicker`).
  `trade-mod.js` **doit** venir après `trade.js` : il
  consomme `window.__TRADE__` que `trade.js` met en place (helpers, état partagé
  `verifiedByUid`/`verifiedPseudos` par référence, `getUid`), et y enregistre en
  retour `renderAdmin` / `checkModerator` que `trade.js` appelle de façon gardée.

## Pas de tests / lint / CI

Vérification = ouvrir `index.html` dans un navigateur. Aucun runner configuré.
