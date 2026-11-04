import { describe, expect, it } from "vitest";
import {
  LOCALE_LANGUAGE_CODES,
  localeForLanguageCode,
  resolveLocale,
  translate,
} from "../src/i18n";
import { en, type TranslationKey } from "../src/i18n/locales/en";
import { zhCN } from "../src/i18n/locales/zh-CN";

describe("i18n", () => {
  it("uses the locale's own translation when it exists", () => {
    expect(translate("zh-CN", "sidebar.trash")).toBe("回收站");
  });

  it("provides a non-empty Chinese translation for every English key", () => {
    expect(Object.keys(zhCN).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as TranslationKey[]) {
      expect(zhCN[key].trim(), key).not.toBe("");
    }
    expect(translate("zh-CN", "common.loading")).toBe("加载中…");
  });

  it("preserves all interpolation placeholders in the Chinese locale", () => {
    const placeholders = (text: string) =>
      (text.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(en) as TranslationKey[]) {
      expect(placeholders(zhCN[key]), key).toEqual(placeholders(en[key]));
    }
    expect(translate("zh-CN", "dashboard.moveItemsTo", { count: 3 })).toBe(
      "将 3 个项目移动到…",
    );
    expect(
      translate("zh-CN", "settings.importCompletedWithErrors", {
        success: 2,
        failed: 1,
        errors: "文件结构无效",
      }),
    ).toBe("导入完成，但有部分错误。\n成功：2\n失败：1\n错误：\n文件结构无效");
  });

  it("interpolates placeholders and leaves unknown ones untouched", () => {
    expect(translate("en", "dashboard.moveItemsTo", { count: 3 })).toBe(
      "Move 3 items to...",
    );
    expect(translate("en", "dashboard.moveItemsTo")).toBe(
      "Move {count} items to...",
    );
  });

  it("resolves browser and editor language codes to a supported locale", () => {
    expect(resolveLocale("zh-CN")).toBe("zh-CN");
    expect(resolveLocale("zh-TW")).toBe("zh-CN");
    expect(resolveLocale("en-GB")).toBe("en");
    expect(resolveLocale("fr-FR")).toBe("fr");
    expect(resolveLocale("fr-CA")).toBe("fr");
    expect(resolveLocale("de-DE")).toBe("en");
    expect(resolveLocale(null)).toBe("en");
  });

  it("maps locales to the language codes the editor understands", () => {
    expect(LOCALE_LANGUAGE_CODES.fr).toBe("fr-FR");
    expect(localeForLanguageCode("fr-FR")).toBe("fr");
    expect(localeForLanguageCode("fr")).toBe("fr");
    expect(localeForLanguageCode("de-DE")).toBeUndefined();
  });

  it("translates into French with French typography", () => {
    expect(translate("fr", "sidebar.trash")).toBe("Corbeille");
    expect(translate("fr", "auth.login.forgotPassword")).toBe(
      "Mot de passe oublié\u202F?",
    );
  });
});
