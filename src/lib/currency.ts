import type { Lang } from "@/i18n/translations";

export interface Currency {
  code: string;
  symbol: string;
  name: Record<Lang, string>;
}

/**
 * Currencies the store can use. The symbol always comes from this list, never
 * from free text (BUG-043).
 */
export const CURRENCIES: readonly Currency[] = [
  { code: "GTQ", symbol: "Q", name: { es: "Quetzal guatemalteco", en: "Guatemalan quetzal" } },
  { code: "USD", symbol: "$", name: { es: "Dólar estadounidense", en: "US dollar" } },
  { code: "MXN", symbol: "$", name: { es: "Peso mexicano", en: "Mexican peso" } },
  { code: "HNL", symbol: "L", name: { es: "Lempira hondureño", en: "Honduran lempira" } },
  { code: "NIO", symbol: "C$", name: { es: "Córdoba nicaragüense", en: "Nicaraguan córdoba" } },
  { code: "CRC", symbol: "₡", name: { es: "Colón costarricense", en: "Costa Rican colón" } },
  { code: "EUR", symbol: "€", name: { es: "Euro", en: "Euro" } },
];

export const DEFAULT_CURRENCY = CURRENCIES[0];

export function findCurrency(code: string): Currency | undefined {
  return CURRENCIES.find((c) => c.code === code);
}
