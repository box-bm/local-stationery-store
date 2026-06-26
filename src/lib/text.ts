/** Strip diacritics and lowercase, so "papél" matches "papel" and vice versa. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Accent/case-insensitive substring match. */
export function fuzzyIncludes(
  haystack: string | null | undefined,
  needle: string
): boolean {
  if (!haystack) return false;
  return normalizeText(haystack).includes(normalizeText(needle));
}
