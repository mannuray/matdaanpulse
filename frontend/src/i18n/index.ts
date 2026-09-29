import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import hi from "./locales/hi.json";
import ta from "./locales/ta.json";
import mr from "./locales/mr.json";

const LANG_STORAGE_KEY = "lang";
const SUPPORTED_LANGS = ["en", "hi", "ta", "mr"];

function readStoredLang(): string {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored && SUPPORTED_LANGS.includes(stored)) return stored;
  } catch {
    // storage unavailable
  }
  return "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    ta: { translation: ta },
    mr: { translation: mr },
  },
  lng: readStoredLang(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

i18n.on("languageChanged", (lng) => {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lng);
  } catch {
    // storage unavailable — language just won't persist
  }
  if (typeof document !== "undefined") document.documentElement.lang = lng;
});

export default i18n;
