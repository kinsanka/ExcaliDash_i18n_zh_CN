import { en } from "./en";
import { zhCN } from "./zh-CN";
import type { Language } from "../context/I18nContext";

type TextPair = {
  source: string;
  target: string;
};

type TemplateRule = {
  pattern: RegExp;
  target: string;
  placeholders: string[];
};

const ATTRIBUTES = ["aria-label", "title", "placeholder", "alt"] as const;

const normalizeText = (value: string): string =>
  value.replace(/\s+/g, " ").replace(/\u2026/g, "...").trim();

const escapeForRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildPairs = (language: Language): TextPair[] => {
  const sourceDictionary = language === "zh-CN" ? en : zhCN;
  const targetDictionary = language === "zh-CN" ? zhCN : en;

  return Object.keys(sourceDictionary).flatMap((key) => {
    const source = sourceDictionary[key];
    const target = targetDictionary[key];
    if (typeof source !== "string" || typeof target !== "string") return [];
    if (source === target) return [];
    return [{ source, target }];
  });
};

const compileTemplate = (source: string, target: string): TemplateRule | null => {
  const placeholders: string[] = [];
  const segments = normalizeText(source).split(/\{(\w+)\}/g);
  if (segments.length === 1) return null;

  let pattern = "^";
  for (let index = 0; index < segments.length; index += 1) {
    if (index % 2 === 0) {
      pattern += escapeForRegex(segments[index]);
    } else {
      placeholders.push(segments[index]);
      pattern += "(.+?)";
    }
  }
  pattern += "$";

  return {
    pattern: new RegExp(pattern),
    target: normalizeText(target),
    placeholders,
  };
};

const createTranslator = (language: Language) => {
  const pairs = buildPairs(language);
  const exact = new Map(
    pairs
      .filter(({ source }) => !/\{\w+\}/.test(source))
      .map(({ source, target }) => [normalizeText(source), target]),
  );
  const templates = pairs.flatMap(({ source, target }) => {
    const rule = compileTemplate(source, target);
    return rule ? [rule] : [];
  });

  return (value: string): string | null => {
    const normalized = normalizeText(value);
    const exactMatch = exact.get(normalized);
    if (exactMatch) return exactMatch;

    for (const rule of templates) {
      const match = normalized.match(rule.pattern);
      if (!match) continue;
      const replacements = new Map(
        rule.placeholders.map((placeholder, index) => [
          placeholder,
          match[index + 1],
        ]),
      );
      return rule.target.replace(/\{(\w+)\}/g, (_, placeholder: string) =>
        replacements.get(placeholder) ?? `{${placeholder}}`,
      );
    }

    return null;
  };
};

const replaceNode = (
  node: Node,
  translate: (value: string) => string | null,
): void => {
  if (node.nodeType === Node.TEXT_NODE) {
    const rawValue = node.textContent;
    if (!rawValue) return;
    const value = rawValue.trim();
    if (!value) return;
    const replacement = translate(value);
    if (replacement && replacement !== value) {
      node.textContent = rawValue.replace(value, replacement);
    }
    return;
  }

  if (!(node instanceof HTMLElement)) return;

  for (const attribute of ATTRIBUTES) {
    const value = node.getAttribute(attribute);
    if (!value) continue;
    const replacement = translate(value);
    if (replacement && replacement !== value) {
      node.setAttribute(attribute, replacement);
    }
  }

  node.childNodes.forEach((child) => replaceNode(child, translate));
};

export const setupAppDomTranslations = (language: Language): (() => void) => {
  const root = document.body;
  const translate = createTranslator(language);
  replaceNode(root, translate);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        replaceNode(mutation.target, translate);
        continue;
      }
      if (mutation.type === "characterData") {
        replaceNode(mutation.target, translate);
        continue;
      }
      mutation.addedNodes.forEach((node) => replaceNode(node, translate));
    }
  });

  observer.observe(root, {
    attributes: true,
    attributeFilter: [...ATTRIBUTES],
    characterData: true,
    childList: true,
    subtree: true,
  });

  return () => observer.disconnect();
};

