// UI translations for the Codex. Essence data (names, descriptions) stays as-is —
// only the interface chrome is translated. Legend values are stored in French in
// data.js, so each language provides `orLess` / `notTraded` to translate those fragments.
window.__I18N__ = {
  langs: [
    { code: 'fr', label: 'FR', name: 'Français' },
    { code: 'en', label: 'EN', name: 'English' },
    { code: 'de', label: 'DE', name: 'Deutsch' },
    { code: 'es', label: 'ES', name: 'Español' },
    { code: 'it', label: 'IT', name: 'Italiano' }
  ],
  strings: {
    fr: {
      docTitle: 'Codex des Essences — Minewind',
      title: 'Codex des Essences',
      subtitle: "Cherchez une essence par son nom ou son surnom — prix par palier et effet, en un coup d'œil.",
      searchPlaceholder: 'Curse of Living Flames, colf, vamp strike, web eater…',
      idleHeading: 'Échelle des paliers de prix observés sur le serveur',
      randomEssence: 'Essence au hasard',
      randomWeapon: 'Une arme au hasard',
      randomSpell: 'Un sort au hasard',
      rerollLabel: 'Relancer :',
      footer1: 'Données extraites des fichiers de prix & descriptions Minewind — {n} essences répertoriées.',
      footer2: "Les prix sont des paliers indicatifs issus d'échanges observés par la communauté, pas des valeurs fixes.",
      essencesWord: 'essences',
      metaUpdated: 'mise à jour des prix',
      metaDiscord: 'discord de trade',
      resultOne: '1 résultat',
      resultMany: '{n} résultats',
      emptyMsg: 'Aucune essence ne porte ce nom dans le codex.',
      emptyHint: "Essayez une abréviation de clan, ou vérifiez l'orthographe.",
      capNote: 'Palier maximum observé : {cap} (niveau {lvl})',
      labelAliases: 'Surnoms / abréviations',
      labelSoul: "Type d'âme requise",
      labelSection: 'Catégorie de clé',
      labelLevels: "Niveaux d'effet",
      levelWord: 'Niveau',
      typeSpell: 'Sort',
      typeWeapon: 'Arme',
      typeArmor: 'Armure',
      orLess: 'ou moins',
      notTraded: 'Pas encore échangé',
      guideTitle: 'Guide débutant',
      guide: {
        money: {
          title: 'La monnaie',
          intro: "Sur le serveur, la monnaie, ce sont les dragon eggs (œufs de dragon).",
          rows: [
            ['1d', '1 dragon egg (œuf de dragon)'],
            ['1s', '1 stack = 64 dragon eggs'],
            ['1sh', '1 shegg = 1 shulker rempli de dragon eggs = 64 × 27 = 1 728 dragon eggs']
          ]
        },
        essence: {
          title: 'Les essences',
          body: "Les essences sont des livres verts qui octroient des pouvoirs. On les applique à une armure ou à une arme à l'aide d'une enclume."
        },
        dura: {
          title: 'Durabilité',
          body: "Le stuff custom ou doté d'une essence est incassable : sa durabilité se bloque à 1 et ne descend jamais en dessous."
        }
      },
      build: {
        tab: 'Équipement',
        newSet: 'Nouveau set',
        setEffect: "Effet de set (cumulé sur l'ensemble)",
        setName: 'Nom du set',
        deleteSet: 'Supprimer',
        deleteSetConfirm: 'Supprimer ce set ?',
        defaultSetName: 'Set',
        heading: "Simulateur d'équipement",
        intro: '3 essences max et 4 âmes max par pièce. Ta configuration est sauvegardée automatiquement sur cet appareil.',
        essences: 'Essences',
        souls: 'Âmes',
        addEssence: 'Essence',
        addSoul: 'Âme',
        searchEssence: 'Rechercher une essence…',
        shopping: "Liste d'achat",
        shoppingEmpty: "Ajoute des essences à ton équipement pour générer ta liste d'achat.",
        remaining: 'restantes',
        acquired: 'acquises',
        ownedShort: 'Acquise',
        reset: 'Réinitialiser',
        resetConfirm: 'Réinitialiser tout ton équipement ? Cette action est irréversible.',
        level: 'Niv.',
        slots: { helmet: 'Casque / Tête', chestplate: 'Plastron', leggings: 'Jambières', boots: 'Bottes', offhand: 'Main secondaire' }
      }
    },
    en: {
      docTitle: 'Codex of Essences — Minewind',
      title: 'Codex of Essences',
      subtitle: 'Search for an essence by its name or nickname — price tier and effect, at a glance.',
      searchPlaceholder: 'Curse of Living Flames, colf, vamp strike, web eater…',
      idleHeading: 'Scale of price tiers observed on the server',
      randomEssence: 'Random essence',
      randomWeapon: 'A random weapon',
      randomSpell: 'A random spell',
      rerollLabel: 'Re-roll:',
      footer1: 'Data extracted from Minewind price & description files — {n} essences listed.',
      footer2: 'Prices are indicative tiers from trades observed by the community, not fixed values.',
      essencesWord: 'essences',
      metaUpdated: 'prices updated',
      metaDiscord: 'trade discord',
      resultOne: '1 result',
      resultMany: '{n} results',
      emptyMsg: 'No essence bears this name in the codex.',
      emptyHint: 'Try a clan abbreviation, or check the spelling.',
      capNote: 'Highest tier observed: {cap} (level {lvl})',
      labelAliases: 'Nicknames / abbreviations',
      labelSoul: 'Required soul type',
      labelSection: 'Key category',
      labelLevels: 'Effect levels',
      levelWord: 'Level',
      typeSpell: 'Spell',
      typeWeapon: 'Weapon',
      typeArmor: 'Armor',
      orLess: 'or less',
      notTraded: 'Not yet traded',
      guideTitle: 'Beginner guide',
      guide: {
        money: {
          title: 'Currency',
          intro: 'On the server, the currency is dragon eggs.',
          rows: [
            ['1d', '1 dragon egg'],
            ['1s', '1 stack = 64 dragon eggs'],
            ['1sh', '1 shegg = 1 shulker full of dragon eggs = 64 × 27 = 1,728 dragon eggs']
          ]
        },
        essence: {
          title: 'Essences',
          body: 'Essences are green books that grant powers. You apply them to armor or weapons using an anvil.'
        },
        dura: {
          title: 'Durability',
          body: 'Custom gear or gear with an essence is unbreakable: its durability stops at 1 and never drops below.'
        }
      },
      build: {
        tab: 'Loadout',
        newSet: 'New set',
        setEffect: 'Set effect (stacked across the loadout)',
        setName: 'Set name',
        deleteSet: 'Delete',
        deleteSetConfirm: 'Delete this set?',
        defaultSetName: 'Set',
        heading: 'Gear simulator',
        intro: 'Up to 3 essences and 4 souls per piece. Your setup is saved automatically on this device.',
        essences: 'Essences',
        souls: 'Souls',
        addEssence: 'Essence',
        addSoul: 'Soul',
        searchEssence: 'Search an essence…',
        shopping: 'Shopping list',
        shoppingEmpty: 'Add essences to your gear to generate your shopping list.',
        remaining: 'remaining',
        acquired: 'owned',
        ownedShort: 'Owned',
        reset: 'Reset',
        resetConfirm: 'Reset your entire loadout? This cannot be undone.',
        level: 'Lvl',
        slots: { helmet: 'Helmet / Head', chestplate: 'Chestplate', leggings: 'Leggings', boots: 'Boots', offhand: 'Offhand' }
      }
    },
    de: {
      docTitle: 'Kodex der Essenzen — Minewind',
      title: 'Kodex der Essenzen',
      subtitle: 'Suche eine Essenz nach Namen oder Spitznamen — Preisstufe und Effekt auf einen Blick.',
      searchPlaceholder: 'Curse of Living Flames, colf, vamp strike, web eater…',
      idleHeading: 'Skala der auf dem Server beobachteten Preisstufen',
      randomEssence: 'Zufällige Essenz',
      randomWeapon: 'Eine zufällige Waffe',
      randomSpell: 'Ein zufälliger Zauber',
      rerollLabel: 'Neu würfeln:',
      footer1: 'Daten aus den Minewind-Preis- und Beschreibungsdateien — {n} Essenzen erfasst.',
      footer2: 'Die Preise sind Richtwerte aus von der Community beobachteten Trades, keine festen Werte.',
      essencesWord: 'Essenzen',
      metaUpdated: 'Preise aktualisiert',
      metaDiscord: 'Trade-Discord',
      resultOne: '1 Ergebnis',
      resultMany: '{n} Ergebnisse',
      emptyMsg: 'Keine Essenz trägt diesen Namen im Kodex.',
      emptyHint: 'Versuche eine Clan-Abkürzung oder prüfe die Schreibweise.',
      capNote: 'Höchste beobachtete Stufe: {cap} (Stufe {lvl})',
      labelAliases: 'Spitznamen / Abkürzungen',
      labelSoul: 'Benötigter Seelentyp',
      labelSection: 'Schlüsselkategorie',
      labelLevels: 'Effektstufen',
      levelWord: 'Stufe',
      typeSpell: 'Zauber',
      typeWeapon: 'Waffe',
      typeArmor: 'Rüstung',
      orLess: 'oder weniger',
      notTraded: 'Noch nicht gehandelt',
      guideTitle: 'Anfänger-Guide',
      guide: {
        money: {
          title: 'Währung',
          intro: 'Auf dem Server ist die Währung Dragon Eggs (Dracheneier).',
          rows: [
            ['1d', '1 Dragon Egg (Drachenei)'],
            ['1s', '1 Stack = 64 Dragon Eggs'],
            ['1sh', '1 Shegg = 1 Shulker voller Dragon Eggs = 64 × 27 = 1.728 Dragon Eggs']
          ]
        },
        essence: {
          title: 'Essenzen',
          body: 'Essenzen sind grüne Bücher, die Kräfte verleihen. Du wendest sie mit einem Amboss auf Rüstung oder Waffen an.'
        },
        dura: {
          title: 'Haltbarkeit',
          body: 'Custom-Ausrüstung oder Ausrüstung mit einer Essenz ist unzerstörbar: Die Haltbarkeit bleibt bei 1 stehen und sinkt nie darunter.'
        }
      },
      build: {
        tab: 'Ausrüstung',
        newSet: 'Neues Set',
        setEffect: 'Set-Effekt (über die ganze Ausrüstung gestapelt)',
        setName: 'Set-Name',
        deleteSet: 'Löschen',
        deleteSetConfirm: 'Dieses Set löschen?',
        defaultSetName: 'Set',
        heading: 'Ausrüstungs-Simulator',
        intro: 'Max. 3 Essenzen und 4 Seelen pro Teil. Deine Konfiguration wird automatisch auf diesem Gerät gespeichert.',
        essences: 'Essenzen',
        souls: 'Seelen',
        addEssence: 'Essenz',
        addSoul: 'Seele',
        searchEssence: 'Essenz suchen…',
        shopping: 'Einkaufsliste',
        shoppingEmpty: 'Füge deiner Ausrüstung Essenzen hinzu, um deine Einkaufsliste zu erstellen.',
        remaining: 'übrig',
        acquired: 'im Besitz',
        ownedShort: 'Habe ich',
        reset: 'Zurücksetzen',
        resetConfirm: 'Gesamte Ausrüstung zurücksetzen? Das kann nicht rückgängig gemacht werden.',
        level: 'Stufe',
        slots: { helmet: 'Helm / Kopf', chestplate: 'Brustpanzer', leggings: 'Beinschutz', boots: 'Stiefel', offhand: 'Nebenhand' }
      }
    },
    es: {
      docTitle: 'Códice de Esencias — Minewind',
      title: 'Códice de Esencias',
      subtitle: 'Busca una esencia por su nombre o apodo — nivel de precio y efecto, de un vistazo.',
      searchPlaceholder: 'Curse of Living Flames, colf, vamp strike, web eater…',
      idleHeading: 'Escala de niveles de precio observados en el servidor',
      randomEssence: 'Esencia al azar',
      randomWeapon: 'Un arma al azar',
      randomSpell: 'Un hechizo al azar',
      rerollLabel: 'Volver a tirar:',
      footer1: 'Datos extraídos de los archivos de precios y descripciones de Minewind — {n} esencias catalogadas.',
      footer2: 'Los precios son niveles indicativos de intercambios observados por la comunidad, no valores fijos.',
      essencesWord: 'esencias',
      metaUpdated: 'precios actualizados',
      metaDiscord: 'discord de intercambio',
      resultOne: '1 resultado',
      resultMany: '{n} resultados',
      emptyMsg: 'Ninguna esencia lleva ese nombre en el códice.',
      emptyHint: 'Prueba una abreviatura de clan o revisa la ortografía.',
      capNote: 'Nivel máximo observado: {cap} (nivel {lvl})',
      labelAliases: 'Apodos / abreviaturas',
      labelSoul: 'Tipo de alma requerida',
      labelSection: 'Categoría de llave',
      labelLevels: 'Niveles de efecto',
      levelWord: 'Nivel',
      typeSpell: 'Hechizo',
      typeWeapon: 'Arma',
      typeArmor: 'Armadura',
      orLess: 'o menos',
      notTraded: 'Aún no intercambiada',
      guideTitle: 'Guía para principiantes',
      guide: {
        money: {
          title: 'La moneda',
          intro: 'En el servidor, la moneda son los dragon eggs (huevos de dragón).',
          rows: [
            ['1d', '1 dragon egg (huevo de dragón)'],
            ['1s', '1 stack = 64 dragon eggs'],
            ['1sh', '1 shegg = 1 shulker lleno de dragon eggs = 64 × 27 = 1.728 dragon eggs']
          ]
        },
        essence: {
          title: 'Las esencias',
          body: 'Las esencias son libros verdes que otorgan poderes. Se aplican a una armadura o un arma usando un yunque.'
        },
        dura: {
          title: 'Durabilidad',
          body: 'El equipo personalizado o con una esencia es irrompible: su durabilidad se detiene en 1 y nunca baja de ahí.'
        }
      },
      build: {
        tab: 'Equipo',
        newSet: 'Nuevo set',
        setEffect: 'Efecto de conjunto (acumulado en todo el equipo)',
        setName: 'Nombre del set',
        deleteSet: 'Eliminar',
        deleteSetConfirm: '¿Eliminar este set?',
        defaultSetName: 'Set',
        heading: 'Simulador de equipo',
        intro: 'Máx. 3 esencias y 4 almas por pieza. Tu configuración se guarda automáticamente en este dispositivo.',
        essences: 'Esencias',
        souls: 'Almas',
        addEssence: 'Esencia',
        addSoul: 'Alma',
        searchEssence: 'Buscar una esencia…',
        shopping: 'Lista de compra',
        shoppingEmpty: 'Añade esencias a tu equipo para generar tu lista de compra.',
        remaining: 'restantes',
        acquired: 'adquiridas',
        ownedShort: 'La tengo',
        reset: 'Reiniciar',
        resetConfirm: '¿Reiniciar todo tu equipo? Esta acción no se puede deshacer.',
        level: 'Nv.',
        slots: { helmet: 'Casco / Cabeza', chestplate: 'Peto', leggings: 'Grebas', boots: 'Botas', offhand: 'Mano secundaria' }
      }
    },
    it: {
      docTitle: 'Codice delle Essenze — Minewind',
      title: 'Codice delle Essenze',
      subtitle: "Cerca un'essenza per nome o soprannome — fascia di prezzo ed effetto, in un colpo d'occhio.",
      searchPlaceholder: 'Curse of Living Flames, colf, vamp strike, web eater…',
      idleHeading: 'Scala delle fasce di prezzo osservate sul server',
      randomEssence: 'Essenza a caso',
      randomWeapon: "Un'arma a caso",
      randomSpell: 'Un incantesimo a caso',
      rerollLabel: 'Rilancia:',
      footer1: 'Dati estratti dai file di prezzi e descrizioni di Minewind — {n} essenze catalogate.',
      footer2: 'I prezzi sono fasce indicative dagli scambi osservati dalla community, non valori fissi.',
      essencesWord: 'essenze',
      metaUpdated: 'prezzi aggiornati',
      metaDiscord: 'discord degli scambi',
      resultOne: '1 risultato',
      resultMany: '{n} risultati',
      emptyMsg: 'Nessuna essenza porta questo nome nel codice.',
      emptyHint: "Prova un'abbreviazione di clan o controlla l'ortografia.",
      capNote: 'Fascia massima osservata: {cap} (livello {lvl})',
      labelAliases: 'Soprannomi / abbreviazioni',
      labelSoul: 'Tipo di anima richiesto',
      labelSection: 'Categoria di chiave',
      labelLevels: "Livelli d'effetto",
      levelWord: 'Livello',
      typeSpell: 'Incantesimo',
      typeWeapon: 'Arma',
      typeArmor: 'Armatura',
      orLess: 'o meno',
      notTraded: 'Non ancora scambiata',
      guideTitle: 'Guida per principianti',
      guide: {
        money: {
          title: 'La valuta',
          intro: 'Sul server la valuta sono i dragon eggs (uova di drago).',
          rows: [
            ['1d', '1 dragon egg (uovo di drago)'],
            ['1s', '1 stack = 64 dragon eggs'],
            ['1sh', '1 shegg = 1 shulker pieno di dragon eggs = 64 × 27 = 1.728 dragon eggs']
          ]
        },
        essence: {
          title: 'Le essenze',
          body: "Le essenze sono libri verdi che conferiscono poteri. Si applicano a un'armatura o a un'arma usando un'incudine."
        },
        dura: {
          title: 'Durabilità',
          body: "L'equipaggiamento custom o con un'essenza è indistruttibile: la durabilità si ferma a 1 e non scende mai sotto."
        }
      },
      build: {
        tab: 'Equipaggiamento',
        newSet: 'Nuovo set',
        setEffect: "Effetto del set (cumulato sull'intero equipaggiamento)",
        setName: 'Nome del set',
        deleteSet: 'Elimina',
        deleteSetConfirm: 'Eliminare questo set?',
        defaultSetName: 'Set',
        heading: 'Simulatore di equipaggiamento',
        intro: 'Massimo 3 essenze e 4 anime per pezzo. La tua configurazione viene salvata automaticamente su questo dispositivo.',
        essences: 'Essenze',
        souls: 'Anime',
        addEssence: 'Essenza',
        addSoul: 'Anima',
        searchEssence: "Cerca un'essenza…",
        shopping: 'Lista della spesa',
        shoppingEmpty: 'Aggiungi essenze al tuo equipaggiamento per generare la lista della spesa.',
        remaining: 'rimanenti',
        acquired: 'possedute',
        ownedShort: "Ce l'ho",
        reset: 'Reimposta',
        resetConfirm: "Reimpostare tutto l'equipaggiamento? L'azione è irreversibile.",
        level: 'Liv.',
        slots: { helmet: 'Elmo / Testa', chestplate: 'Corazza', leggings: 'Gambali', boots: 'Stivali', offhand: 'Mano secondaria' }
      }
    }
  }
};
