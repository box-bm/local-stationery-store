import { installTauriMock, type ProductFixture } from "./tauri-mock";

export interface VisitAppOptions {
  /** Valores para `libreria-settings` en localStorage (se mezclan con los de la suite). */
  settings?: Record<string, unknown>;
  /** Productos extra. Por defecto los de e2e/fixtures/productos.json. */
  products?: ProductFixture[];
  /** Incluir los 3 productos de ejemplo de la migración v2. Por defecto true. */
  seed?: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Abre la app (pantalla Punto de venta) con Tauri simulado y BD nueva. */
      visitApp(opts?: VisitAppOptions): Chainable<void>;
      /** Ejecuta un SELECT contra la BD simulada. */
      dbSelect<T = Record<string, any>>(sql: string, params?: unknown[]): Chainable<T[]>;
      /** Simula un lector de código de barras (teclas rápidas + Enter). */
      scanBarcode(code: string): Chainable<void>;
      /** Tarjeta de producto en la grilla del POS. */
      productCard(name: string): Chainable<JQuery<HTMLElement>>;
      /** Contenedor del carrito lateral. */
      cart(): Chainable<JQuery<HTMLElement>>;
      /** Diálogo modal abierto. */
      dialog(): Chainable<JQuery<HTMLElement>>;
      /** Selecciona producto, unidad y cantidad, y lo agrega al carrito. */
      addToCart(name: string, opts?: { unit?: string; qty?: number }): Chainable<void>;
      /** Escribe en el buscador del POS. */
      searchProduct(text: string): Chainable<void>;
      /** Verifica que aparezca una notificación (toast) con el texto dado. */
      toast(text: string | RegExp): Chainable<JQuery<HTMLElement>>;
    }
  }
}

const BASE_SETTINGS = {
  language: "es",
  theme: "light",
  currencySymbol: "Q",
  currencyCode: "GTQ",
  onboardingDone: true,
  lockEnabled: false,
  paymentMethods: { cash: true, transfer: true },
};

export const SEARCH_PLACEHOLDER = "Buscar producto por nombre o escanear código de barras…";

Cypress.Commands.add("visitApp", (opts: VisitAppOptions = {}) => {
  cy.readFile("node_modules/sql.js/dist/sql-asm.js", { log: false }).then((sqlJsSource: string) => {
    cy.readFile("src-tauri/src/lib.rs", { log: false }).then((libRs: string) => {
      cy.fixture("productos.json").then(({ productos }) => {
        cy.visit("/", {
          onBeforeLoad(win) {
            win.localStorage.clear();
            win.localStorage.setItem(
              "libreria-settings",
              JSON.stringify({ ...BASE_SETTINGS, ...opts.settings })
            );
            installTauriMock(win, {
              sqlJsSource,
              libRs,
              products: opts.products ?? productos,
              seed: opts.seed,
            });
          },
        });
      });
    });
  });
  cy.window().its("__E2E__.ready");
  cy.get(`input[placeholder="${SEARCH_PLACEHOLDER}"]`).should("be.visible");
});

Cypress.Commands.add("dbSelect", (sql: string, params: unknown[] = []) => {
  return cy.window({ log: false }).then((win) => win.__E2E__.select(sql, params)) as never;
});

Cypress.Commands.add("scanBarcode", (code: string) => {
  // El hook useBarcodeScanner escucha keydown en window y considera "escaneo"
  // a teclas separadas por menos de 50 ms que terminan en Enter.
  cy.window().then((win) => {
    const target = win.document.activeElement ?? win.document.body;
    for (const key of [...code, "Enter"]) {
      target.dispatchEvent(new win.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    }
  });
});

Cypress.Commands.add("productCard", (name: string) => {
  return cy.contains("main .grid > button", name);
});

Cypress.Commands.add("cart", () => {
  // En pantallas angostas el carrito en línea queda oculto (display:none) y se
  // usa el panel deslizable, así que se toma solo el que está visible.
  return cy.contains("h2:visible", "Carrito").parent().parent();
});

Cypress.Commands.add("dialog", () => {
  return cy.get('[role="dialog"]').should("be.visible");
});

Cypress.Commands.add("searchProduct", (text: string) => {
  cy.get(`input[placeholder="${SEARCH_PLACEHOLDER}"]`).clear().type(text);
});

Cypress.Commands.add("addToCart", (name: string, opts: { unit?: string; qty?: number } = {}) => {
  cy.productCard(name).click();
  cy.dialog().within(() => {
    cy.contains("h2", name);
    if (opts.unit) cy.contains("button", opts.unit).click();
    if (opts.qty != null) cy.get("#qty").clear().type(String(opts.qty));
    cy.contains("button", "Agregar al carrito").click();
  });
  cy.get('[role="dialog"]').should("not.exist");
});

Cypress.Commands.add("toast", (text: string | RegExp) => {
  return cy.contains("body > div.fixed p", text);
});
