import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import tr from './locales/tr.json';
import de from './locales/de.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import it from './locales/it.json';
import pt from './locales/pt.json';
import nl from './locales/nl.json';
import pl from './locales/pl.json';
import ru from './locales/ru.json';

const STORAGE_KEY = 'app-language';

/** Supported languages — used by the picker UI */
export const LANGUAGES = [
  { code: 'en', label: 'English',    flag: '🇬🇧' },
  { code: 'tr', label: 'Türkçe',     flag: '🇹🇷' },
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪' },
  { code: 'es', label: 'Español',    flag: '🇪🇸' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷' },
  { code: 'it', label: 'Italiano',   flag: '🇮🇹' },
  { code: 'pt', label: 'Português',  flag: '🇵🇹' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', label: 'Polski',     flag: '🇵🇱' },
  { code: 'ru', label: 'Русский',    flag: '🇷🇺' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

const resources = {
  en: { translation: en },
  tr: { translation: tr },
  de: { translation: de },
  es: { translation: es },
  fr: { translation: fr },
  it: { translation: it },
  pt: { translation: pt },
  nl: { translation: nl },
  pl: { translation: pl },
  ru: { translation: ru },
};

const isSupported = (code?: string | null): code is LanguageCode =>
  !!code && LANGUAGES.some((l) => l.code === code);

/** Best initial guess from the device locale; falls back to English */
function deviceLanguage(): LanguageCode {
  const code = Localization.getLocales()[0]?.languageCode ?? 'en';
  return isSupported(code) ? code : 'en';
}

// Initialise synchronously with the device language so the UI is ready
// immediately (translations are bundled — no async backend needed).
i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// Then asynchronously override with the user's saved choice, if any.
AsyncStorage.getItem(STORAGE_KEY)
  .then((saved) => {
    if (isSupported(saved) && saved !== i18n.language) {
      void i18n.changeLanguage(saved);
    }
  })
  .catch(() => { /* ignore — keep device language */ });

/** Change language and persist the choice */
export async function setLanguage(code: LanguageCode): Promise<void> {
  await i18n.changeLanguage(code);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, code);
  } catch { /* ignore persistence failure */ }
}

export default i18n;
