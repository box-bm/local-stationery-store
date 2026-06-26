// Aggregates the per-language dictionaries. Add a new language by creating
// another file under ./locales and registering it here.
import { es, type TranslationKey } from "./locales/es";
import { en } from "./locales/en";

export type Lang = "es" | "en";

export const translations: Record<Lang, Record<TranslationKey, string>> = {
  es,
  en,
};

export type { TranslationKey };
