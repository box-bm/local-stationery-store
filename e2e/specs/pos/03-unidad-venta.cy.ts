import { tc } from "../../support/qase";

// Punto de venta: selección de unidad de venta y cantidad (SellUnitModal).
// Técnicas: clases de equivalencia y valores límite sobre la cantidad.
const subtotal = () => cy.contains("span", "Subtotal").next();
const remaining = () => cy.contains("span", "Stock restante tras la venta").next();
const addButton = () => cy.contains("button", "Agregar al carrito");

describe("POS · Unidad de venta y cantidad", () => {
  beforeEach(() => cy.visitApp());

  it(tc("TC-POS-018 abre el modal con stock, unidades disponibles y la unidad por defecto"), () => {
    cy.productCard("Tijera escolar").click();
    cy.dialog().within(() => {
      cy.contains("h2", "Tijera escolar");
      cy.contains("Stock: 4 unidad");
      cy.contains("button", "Unidad").should("have.class", "border-primary").and("contain", "Q12.00");
      cy.contains("button", "Par").should("not.have.class", "border-primary").and("contain", "Q22.00");
      cy.contains("button", "Par").should("contain", "2 unidad c/u");
      cy.get("#qty").should("have.value", "1").and("be.focused");
      subtotal().should("have.text", "Q12.00");
      remaining().should("contain", "3 unidad");
    });
  });

  it(tc("TC-POS-019 al cambiar de unidad recalcula subtotal y stock restante"), () => {
    cy.productCard("Tijera escolar").click();
    cy.dialog().within(() => {
      cy.contains("button", "Par").click().should("have.class", "border-primary");
      subtotal().should("have.text", "Q22.00");
      remaining().should("contain", "2 unidad");
    });
  });

  it(tc("TC-POS-020 unidades fraccionarias descuentan la fracción correcta de la unidad base"), () => {
    cy.productCard("Papel bond carta 80g").click();
    cy.dialog().within(() => {
      cy.contains("button", "4 hojas").click();
      cy.get("#qty").clear().type("3");
      subtotal().should("have.text", "Q3.00");
      remaining().should("contain", "4.976 resma");
    });
  });

  it(tc("TC-POS-021 los botones + y − cambian la cantidad sin bajar de 1"), () => {
    cy.productCard("Marcador permanente negro").click();
    cy.dialog().within(() => {
      cy.contains("button", "+").click().click();
      cy.get("#qty").should("have.value", "3");
      subtotal().should("have.text", "Q22.50");
      cy.contains("button", "−").click().click().click().click();
      cy.get("#qty").should("have.value", "1");
      subtotal().should("have.text", "Q7.50");
    });
  });

  context("Valores límite de cantidad vs stock (Tijera: stock 4)", () => {
    it(tc("TC-POS-022 cantidad igual al stock (4) es válida y deja el stock en 0"), () => {
      cy.productCard("Tijera escolar").click();
      cy.dialog().within(() => {
        cy.get("#qty").clear().type("4");
        remaining().should("contain", "0 unidad");
        cy.contains("No hay stock suficiente").should("not.exist");
        addButton().should("be.enabled");
      });
    });

    it(tc("TC-POS-023 cantidad igual a stock + 1 (5) bloquea el botón Agregar"), () => {
      cy.productCard("Tijera escolar").click();
      cy.dialog().within(() => {
        cy.get("#qty").clear().type("5");
        remaining().should("contain", "-1 unidad").and("have.class", "text-destructive");
        cy.contains("No hay stock suficiente para esta cantidad.").should("be.visible");
        addButton().should("be.disabled");
      });
    });

    it(tc("TC-POS-024 el límite también aplica a unidades que agrupan varias unidades base"), () => {
      cy.productCard("Tijera escolar").click();
      cy.dialog().within(() => {
        cy.contains("button", "Par").click();
        cy.get("#qty").clear().type("2");
        addButton().should("be.enabled");
        cy.get("#qty").clear().type("3");
        addButton().should("be.disabled");
      });
    });

    it(tc("TC-POS-025 Enter no agrega al carrito cuando el stock es insuficiente"), () => {
      cy.productCard("Tijera escolar").click();
      cy.get("#qty").clear().type("9{enter}");
      cy.dialog();
      cy.cart().should("contain", "El carrito está vacío");
    });
  });

  // Las 3 variantes reportan al mismo caso de Qase:
  // qase: TC-POS-026 Cantidad fuera del dominio entero positivo se normaliza (0, negativo, decimal)
  context("Clases de equivalencia de cantidad", () => {
    [
      { entrada: "0", esperado: "Q12.00", nota: "cero se normaliza a 1" },
      { entrada: "-3", esperado: "Q12.00", nota: "negativo se normaliza a 1" },
      { entrada: "2.7", esperado: "Q24.00", nota: "decimal se trunca a 2" },
    ].forEach(({ entrada, esperado, nota }, i) => {
      it(tc(`TC-POS-026.${i + 1} cantidad "${entrada}": ${nota}`), () => {
        cy.productCard("Tijera escolar").click();
        cy.dialog().within(() => {
          cy.get("#qty").clear().type(entrada);
          subtotal().should("have.text", esperado);
        });
      });
    });
  });

  it(tc("TC-POS-027 un producto agotado no abre el modal y muestra un aviso"), () => {
    cy.productCard("Borrador blanco").click();
    cy.toast("Borrador blanco no tiene stock disponible. Reabastecé antes de venderlo.").should("be.visible");
    cy.get('[role="dialog"]').should("not.exist");
  });

  it(tc("TC-POS-028 Cancelar cierra el modal sin modificar el carrito"), () => {
    cy.productCard("Marcador permanente negro").click();
    cy.dialog().contains("button", "Cancelar").click();
    cy.get('[role="dialog"]').should("not.exist");
    cy.cart().should("contain", "El carrito está vacío");
  });

  it(tc("TC-POS-029 Enter en el modal agrega la selección al carrito"), () => {
    cy.productCard("Marcador permanente negro").click();
    cy.get("#qty").clear().type("2{enter}");
    cy.get('[role="dialog"]').should("not.exist");
    cy.cart().should("contain", "Marcador permanente negro").and("contain", "Q15.00");
  });
});
