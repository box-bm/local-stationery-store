import { tc } from "../../support/qase";

// Punto de venta en pantallas angostas (< 1024 px): el carrito pasa a un botón
// flotante con panel deslizable.
const fab = () => cy.get("button.fixed.bottom-5.right-5");

describe("POS · Pantalla angosta", () => {
  beforeEach(() => {
    cy.viewport(820, 900);
    cy.visitApp();
  });

  it(tc("TC-POS-060 oculta el carrito lateral y muestra el botón flotante con el total"), () => {
    cy.contains("h2:visible", "Carrito").should("not.exist");
    fab().should("be.visible").and("contain", "Q0.00");
  });

  it(tc("TC-POS-061 el botón flotante refleja total y cantidad de artículos"), () => {
    cy.addToCart("Marcador permanente negro", { qty: 3 });
    fab().should("contain", "Q22.50").find("span").last().should("have.text", "3");
  });

  it(tc("TC-POS-062 abre el panel del carrito y permite cobrar desde ahí"), () => {
    cy.addToCart("Marcador permanente negro");
    fab().click();
    cy.cart().should("be.visible").and("contain", "Marcador permanente negro");
    cy.cart().contains("button", "Completar venta").click();
    cy.dialog().contains("button", /^Cobrar /).click();
    cy.dialog().contains("¡Venta completada!");
  });

  it(tc("TC-POS-063 el panel del carrito se cierra al tocar el fondo"), () => {
    fab().click();
    cy.cart().should("be.visible");
    cy.get("div.fixed.inset-0 > div.absolute.inset-0").click("left");
    cy.contains("h2:visible", "Carrito").should("not.exist");
  });
});
