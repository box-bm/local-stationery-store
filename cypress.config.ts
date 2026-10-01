import { defineConfig } from "cypress";

// E2E (caja negra) del frontend corriendo en el navegador con `npm run dev`.
// El runtime de Tauri no existe en el navegador, así que el IPC se simula en
// e2e/support/tauri-mock.ts con un SQLite en memoria (sql.js) construido con
// las migraciones reales de src-tauri/src/lib.rs.
export default defineConfig({
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
  },
});
