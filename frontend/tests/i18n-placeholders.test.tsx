import { describe, expect, it } from "vitest";
import {
  en,
  type LocaleMessages,
  type TranslationKey,
} from "../src/i18n/locales/en";
import { fr } from "../src/i18n/locales/fr";
import { zhCN } from "../src/i18n/locales/zh-CN";

const locales: Record<string, LocaleMessages> = { fr, "zh-CN": zhCN };
const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

describe.each(Object.entries(locales))(
  "%s placeholders",
  (_locale, messages) => {
    it("preserves placeholders in the translations the locale defines", () => {
      for (const [key, value] of Object.entries(messages)) {
        if (value === undefined) continue;
        expect(placeholders(value), key).toEqual(
          placeholders(en[key as TranslationKey]),
        );
      }
    });
  },
);
