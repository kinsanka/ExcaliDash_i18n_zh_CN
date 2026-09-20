import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { enUS, zhCN } from "date-fns/locale";
import { useOptionalPreferences } from "./PreferencesContext";
import {
  LANGUAGE_STORAGE_KEY,
  getCurrentLanguage,
  getLanguageStorage,
  translations,
  type TranslationParams,
  type TranslationValue,
} from "../i18n";

export type Language = "en" | "zh-CN";

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, params?: TranslationParams) => string;
  isChinese: boolean;
  dateLocale: typeof enUS;
  excalidrawLangCode: string;
};

const format = (
  value: TranslationValue,
  params?: TranslationParams,
): string => {
  if (typeof value === "function") {
    return value(params);
  }
  if (!params) {
    return value;
  }
  return value.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
};

const detectLanguage = (): Language => getCurrentLanguage();

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const preferencesContext = useOptionalPreferences();
  const [localLanguage, setLocalLanguage] = useState<string>(detectLanguage);
  const storedLanguage =
    preferencesContext?.preferences.language ?? localLanguage;
  const language: Language = storedLanguage === "zh-CN" ? "zh-CN" : "en";
  const setStoredLanguage = useCallback(
    (nextLanguage: string) => {
      setLocalLanguage(nextLanguage);
      preferencesContext?.setPreference("language", nextLanguage);
    },
    [preferencesContext],
  );

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
    const storage = getLanguageStorage();
    storage?.setItem(LANGUAGE_STORAGE_KEY, language);
    storage?.setItem("excalidash-lang", storedLanguage);
  }, [language, storedLanguage]);

  const value = useMemo<I18nContextValue>(() => {
    const dictionary = translations[language] as Record<string, TranslationValue>;
    const fallback = translations.en as Record<string, TranslationValue>;
    const t = (key: string, params?: TranslationParams) =>
      format(dictionary[key] ?? fallback[key] ?? key, params);

    return {
      language,
      setLanguage: (nextLanguage) => setStoredLanguage(nextLanguage),
      toggleLanguage: () =>
        setStoredLanguage(language === "zh-CN" ? "en" : "zh-CN"),
      t,
      isChinese: language === "zh-CN",
      dateLocale: language === "zh-CN" ? zhCN : enUS,
      excalidrawLangCode: language === "zh-CN" ? "zh-CN" : "en-US",
    };
  }, [language, setStoredLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
};
