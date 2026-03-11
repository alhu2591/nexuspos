import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const de = {
  translation: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.checkout': 'Kasse',
    'nav.products': 'Produkte',
    'nav.categories': 'Kategorien',
    'nav.inventory': 'Lager',
    'nav.customers': 'Kunden',
    'nav.receipts': 'Kassenbons',
    'nav.invoices': 'Rechnungen',
    'nav.shifts': 'Schichten',
    'nav.reports': 'Berichte',
    'nav.users': 'Benutzer',
    'nav.settings': 'Einstellungen',
    // Common
    'common.all': 'Alle',
    'common.back': 'Zurück',
    'common.total': 'Gesamt',
    'common.cancel': 'Abbrechen',
    'common.save': 'Speichern',
    'common.delete': 'Löschen',
    'common.edit': 'Bearbeiten',
    'common.search': 'Suchen',
    'common.loading': 'Laden...',
    'common.error': 'Fehler',
    'common.success': 'Erfolgreich',
    // Products
    'product.searchPlaceholder': 'Produkt suchen oder scannen...',
    'product.noResults': 'Keine Produkte gefunden',
    'product.startTyping': 'Tippen Sie zum Suchen',
    'product.productsFound': 'Produkte',
    // Payment
    'payment.title': 'Zahlung',
    'payment.cash': 'Bargeld',
    'payment.card': 'Karte',
    'payment.complete': 'Abschließen',
    // Shifts
    'shift.open': 'Schicht öffnen',
    'shift.close': 'Schicht schließen',
    'shift.noOpen': 'Keine offene Schicht',
  },
};

const en = {
  translation: {
    'nav.dashboard': 'Dashboard',
    'nav.checkout': 'Checkout',
    'nav.products': 'Products',
    'nav.categories': 'Categories',
    'nav.inventory': 'Inventory',
    'nav.customers': 'Customers',
    'nav.receipts': 'Receipts',
    'nav.invoices': 'Invoices',
    'nav.shifts': 'Shifts',
    'nav.reports': 'Reports',
    'nav.users': 'Users',
    'nav.settings': 'Settings',
    'common.all': 'All',
    'common.back': 'Back',
    'common.total': 'Total',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'product.searchPlaceholder': 'Search or scan product...',
    'product.noResults': 'No products found',
    'product.startTyping': 'Start typing to search',
    'product.productsFound': 'Products',
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { de, en },
    lng: 'de',
    fallbackLng: 'de',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
