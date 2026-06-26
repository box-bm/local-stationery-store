import { useSettingsStore } from "@/stores/settings";
import { translations, type Lang, type TranslationKey } from "./translations";

export type { Lang, TranslationKey };

type Vars = Record<string, string | number>;

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? String(vars[k]) : `{${k}}`
  );
}

/** Translate a key for a given language (usable outside React). */
export function translate(
  lang: Lang,
  key: TranslationKey,
  vars?: Vars
): string {
  const dict = translations[lang] ?? translations.es;
  const template = (dict as Record<string, string>)[key] ?? key;
  return interpolate(template, vars);
}

/** React hook returning a translate function bound to the current language. */
export function useT() {
  const language = useSettingsStore((s) => s.language);
  return (key: TranslationKey, vars?: Vars) => translate(language, key, vars);
}

/** Non-reactive translator using the current store language. */
export function t(key: TranslationKey, vars?: Vars): string {
  return translate(useSettingsStore.getState().language, key, vars);
}
