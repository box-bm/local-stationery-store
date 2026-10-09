#!/usr/bin/env node
// Crea en Qase TestOps los casos de prueba automatizados del POS y guarda el
// mapeo código → ID en e2e/qase/case-ids.json, que usa el helper tc() de
// e2e/support/qase.ts para enlazar cada resultado de Cypress con su caso.
//
// El catálogo sale de los propios specs: cada `it(tc("TC-POS-### ..."))` o
// `it(tc("H-## ..."))` es un caso, y cada archivo es una suite. Es idempotente:
// los códigos que ya tienen ID en case-ids.json no se vuelven a crear.
//
// Uso:
//   node e2e/qase/sync-cases.mjs --dry-run          muestra el catálogo, no llama a la API
//   node e2e/qase/sync-cases.mjs --csv casos.csv    exporta el catálogo a CSV (importación manual)
//   node e2e/qase/sync-cases.mjs                    crea suites y casos en Qase
//
// Variables de entorno (modo real): QASE_TESTOPS_PROJECT y QASE_TESTOPS_API_TOKEN.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SPECS_DIR = path.join(ROOT, "e2e/specs/pos");
const MAPPING_FILE = path.join(ROOT, "e2e/qase/case-ids.json");
const API = "https://api.qase.io/v1";
const ROOT_SUITE = "Punto de venta · E2E Cypress";

const CODE = /^(TC-POS-\d{3}|H-\d{2})/;
const PRECONDITIONS =
  "Frontend en el navegador (npm run dev) con el IPC de Tauri simulado. " +
  "BD SQLite en memoria creada con las migraciones reales de src-tauri/src/lib.rs, " +
  "los 3 productos de ejemplo (migración v2) y los de e2e/fixtures/productos.json. " +
  "Idioma español, moneda Q, guía de inicio omitida.";

/** Lee los specs y devuelve [{ file, suite, suiteDescription, cases: [{ code, title }] }]. */
export function readCatalog() {
  const files = readdirSync(SPECS_DIR).filter((f) => f.endsWith(".cy.ts")).sort();
  return files.map((file) => {
    const src = readFileSync(path.join(SPECS_DIR, file), "utf8");
    const suite = src.match(/describe\(\s*"([^"]+)"/)?.[1] ?? file;

    // Comentario de cabecera (antes del primer describe/const) como descripción de la suite.
    const header = [];
    for (const line of src.split(/\r?\n/)) {
      if (line.startsWith("import ") || line.trim() === "") continue;
      if (!line.startsWith("//")) break;
      header.push(line.replace(/^\/\/ ?/, ""));
    }

    // Títulos explícitos para tests con título dinámico: `// qase: CODE título`.
    const overrides = new Map();
    for (const m of src.matchAll(/\/\/ qase: (\S+) (.+)/g)) overrides.set(m[1], `${m[1]} ${m[2].trim()}`);

    const cases = [];
    const seen = new Set();
    for (const m of src.matchAll(/it\(tc\((["`])(.*?)\1\)/g)) {
      const raw = m[2];
      const code = raw.match(CODE)?.[1];
      if (!code || seen.has(code)) continue;
      seen.add(code);
      const title = overrides.get(code) ?? (raw.includes("${") ? null : raw);
      if (!title) throw new Error(`${file}: "${raw}" tiene título dinámico; agrega "// qase: ${code} <título>"`);
      cases.push({ code, title });
    }
    return { file, suite, suiteDescription: header.join("\n"), cases };
  });
}

function caseDescription(file, code) {
  const lines = [`Prueba automatizada con Cypress: e2e/specs/pos/${file}`];
  if (code.startsWith("H-")) {
    lines.push(
      "",
      "Hipótesis de defecto: la prueba afirma el comportamiento ESPERADO. " +
        "Si falla, el defecto está presente; registrar el BUG-### correspondiente."
    );
  }
  return lines.join("\n");
}

function loadMapping() {
  return JSON.parse(readFileSync(MAPPING_FILE, "utf8"));
}

function saveMapping(mapping) {
  writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2) + "\n");
}

function toCsv(catalog) {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [["suite", "title", "description", "preconditions", "automation", "tags"]];
  for (const s of catalog) {
    for (const c of s.cases) {
      const tags = ["e2e", "cypress", "pos", c.code.startsWith("H-") ? "hallazgo" : "regresion"].join(",");
      rows.push([s.suite, c.title, caseDescription(s.file, c.code), PRECONDITIONS, "automated", tags]);
    }
  }
  return rows.map((r) => r.map(esc).join(",")).join("\n") + "\n";
}

async function api(method, url, token, body) {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: { Token: token, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status === false) {
    throw new Error(`${method} ${url} → HTTP ${res.status}: ${JSON.stringify(json.errorMessage ?? json.errorFields ?? json)}`);
  }
  return json.result;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sync(catalog) {
  const project = process.env.QASE_TESTOPS_PROJECT;
  const token = process.env.QASE_TESTOPS_API_TOKEN;
  if (!project || !token) {
    console.error("Faltan QASE_TESTOPS_PROJECT y/o QASE_TESTOPS_API_TOKEN.");
    process.exit(1);
  }

  const mapping = loadMapping();
  if (mapping.project && mapping.project !== project) {
    console.error(`case-ids.json pertenece al proyecto ${mapping.project}, no a ${project}.`);
    process.exit(1);
  }
  mapping.project = project;

  const info = await api("GET", `/project/${project}`, token);
  console.log(`Proyecto Qase: ${info.title} (${project})`);

  if (!mapping.suites[ROOT_SUITE]) {
    const r = await api("POST", `/suite/${project}`, token, {
      title: ROOT_SUITE,
      description: "Suite automatizada del menú Punto de venta (Cypress). Ver e2e/README.md.",
    });
    mapping.suites[ROOT_SUITE] = r.id;
    saveMapping(mapping);
  }

  let created = 0;
  for (const s of catalog) {
    if (!mapping.suites[s.suite]) {
      const r = await api("POST", `/suite/${project}`, token, {
        title: s.suite,
        description: s.suiteDescription,
        parent_id: mapping.suites[ROOT_SUITE],
      });
      mapping.suites[s.suite] = r.id;
      saveMapping(mapping);
      console.log(`+ suite ${s.suite} → ${r.id}`);
    }
    for (const c of s.cases) {
      if (mapping.cases[c.code]) continue;
      const r = await api("POST", `/case/${project}`, token, {
        title: c.title,
        description: caseDescription(s.file, c.code),
        preconditions: PRECONDITIONS,
        suite_id: mapping.suites[s.suite],
        automation: 2, // automatizado
        tags: ["e2e", "cypress", "pos", c.code.startsWith("H-") ? "hallazgo" : "regresion"],
      });
      mapping.cases[c.code] = r.id;
      saveMapping(mapping); // se guarda tras cada alta por si algo falla a mitad
      created++;
      console.log(`+ ${c.code} → ${project}-${r.id}`);
      await sleep(150);
    }
  }
  console.log(`Listo: ${created} casos nuevos, ${Object.keys(mapping.cases).length} enlazados en total.`);
}

const args = process.argv.slice(2);
const catalog = readCatalog();
const total = catalog.reduce((n, s) => n + s.cases.length, 0);

if (args.includes("--dry-run")) {
  for (const s of catalog) {
    console.log(`\n${s.suite}  (${s.file}, ${s.cases.length} casos)`);
    for (const c of s.cases) console.log(`  ${c.title}`);
  }
  console.log(`\nTotal: ${catalog.length} suites, ${total} casos.`);
} else if (args.includes("--csv")) {
  const out = args[args.indexOf("--csv") + 1] ?? "e2e/reports/qase-casos.csv";
  writeFileSync(path.resolve(ROOT, out), toCsv(catalog));
  console.log(`CSV con ${total} casos: ${out}`);
} else {
  await sync(catalog);
}
