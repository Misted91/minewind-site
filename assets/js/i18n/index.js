// Assembles the public i18n object from the per-language files loaded before it.
// Each fr/en/de/es/it.js populates window.__I18N_STRINGS__[code]; this file just
// declares the available languages and exposes everything as window.__I18N__.
//
// UI translations only — essence data (names, descriptions) stays as-is. Legend
// values are stored in French in data.js, so each language provides `orLess` /
// `notTraded` to translate those fragments.
window.__I18N__ = {
  langs: [
    { code: 'fr', label: 'FR', name: 'Français' },
    { code: 'en', label: 'EN', name: 'English' },
    { code: 'de', label: 'DE', name: 'Deutsch' },
    { code: 'es', label: 'ES', name: 'Español' },
    { code: 'it', label: 'IT', name: 'Italiano' }
  ],
  strings: window.__I18N_STRINGS__ || {}
};
