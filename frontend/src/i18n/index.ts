import { en } from "./en";
import { zhCN } from "./zh-CN";
import type { TranslationDictionary } from "./types";
import type { TranslationParams, TranslationValue } from "./types";

export const translations: Record<"en" | "zh-CN", TranslationDictionary> = {
  en,
  "zh-CN": zhCN,
};

export const LANGUAGE_STORAGE_KEY = "excalidash-language";

export const getLanguageStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
};

export const getCurrentLanguage = (): "en" | "zh-CN" => {
  const stored = getLanguageStorage()?.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === "zh-CN" || stored === "en") {
    return stored;
  }
  const preferred =
    typeof navigator === "undefined" ? "" : navigator.language?.toLowerCase() ?? "";
  return preferred.startsWith("zh") ? "zh-CN" : "en";
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

export const translate = (key: string, params?: TranslationParams): string => {
  const language = getCurrentLanguage();
  const dictionary = translations[language] as Record<string, TranslationValue>;
  const fallback = translations.en as Record<string, TranslationValue>;
  return format(dictionary[key] ?? fallback[key] ?? key, params);
};

export type { TranslationDictionary, TranslationParams, TranslationValue } from "./types";
