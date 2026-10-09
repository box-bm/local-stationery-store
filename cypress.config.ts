import { defineConfig } from "cypress";
import qasePlugin from "cypress-qase-reporter/plugin";
import qaseMetadata from "cypress-qase-reporter/metadata";

// E2E (caja negra) del frontend corriendo en el navegador con `npm run dev`.
// El runtime de Tauri no existe en el navegador, así que el IPC se simula en
// e2e/support/tauri-mock.ts con un SQLite en memoria (sql.js) construido con
// las migraciones reales de src-tauri/src/lib.rs.
//
// Reporte a Qase TestOps: desactivado salvo que se definan las variables de
// entorno QASE_MODE=testops, QASE_TESTOPS_PROJECT y QASE_TESTOPS_API_TOKEN
// (ver e2e/README.md). El token nunca va en el repositorio.
/** Fecha y hora local "AAAA-MM-DD HH:MM" para el título del run en Qase. */
function localStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default defineConfig({
  reporter: "cypress-multi-reporters",
  reporterOptions: {
    reporterEnabled: "spec, cypress-qase-reporter",
    cypressQaseReporterReporterOptions: {
      testops: {
        uploadAttachments: true,
        run: {
          title: `Cypress E2E · Punto de venta · ${localStamp()}`,
          complete: true,
        },
      },
      framework: {
        cypress: {
          screenshotsFolder: "e2e/reports/screenshots",
          videosFolder: "e2e/reports/videos",
        },
      },
    },
  },
  e2e: {
    baseUrl: "http://localhost:1420",
    specPattern: "e2e/specs/**/*.cy.ts",
    supportFile: "e2e/support/e2e.ts",
    fixturesFolder: "e2e/fixtures",
    screenshotsFolder: "e2e/reports/screenshots",
    videosFolder: "e2e/reports/videos",
    downloadsFolder: "e2e/reports/downloads",
    // Ancho >= 1024 px para que el carrito se muestre en línea (breakpoint lg).
    viewportWidth: 1366,
    viewportHeight: 800,
    video: true,
    defaultCommandTimeout: 8000,
    retries: { runMode: 1, openMode: 0 },
    setupNodeEvents(on, config) {
      qasePlugin(on, config);
      // Su .d.ts declara `export {}`, pero en ejecución exporta la función que registra las tareas.
      (qaseMetadata as unknown as (on: Cypress.PluginEvents) => void)(on);
      return config;
    },
  },
});
