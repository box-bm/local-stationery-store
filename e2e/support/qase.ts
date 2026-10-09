import { qase } from "cypress-qase-reporter/mocha";
import mapping from "../qase/case-ids.json";

const CODE = /^(TC-POS-\d{3}|H-\d{2})/;
const cases = mapping.cases as Record<string, number>;
const links = mapping.links as unknown as Record<string, number[] | undefined>;

/**
 * Enlaza el título de un test con sus casos en Qase. El código al inicio del
 * título (TC-POS-### o H-##) se busca en e2e/qase/case-ids.json: `cases` (que
 * genera `npm run qase:sync`) y `links` (casos manuales ya existentes que
 * también reciben el resultado). Sin IDs, se deja el título tal cual.
 */
export function tc(title: string): string {
  const code = title.match(CODE)?.[1];
  if (!code) return title;
  const ids = [cases[code], ...(links[code] ?? [])].filter((id): id is number => typeof id === "number");
  // Con un título string, qase() devuelve "<título> (Qase ID: n[,m])".
  return ids.length ? (qase(ids, title) as string) : title;
}
