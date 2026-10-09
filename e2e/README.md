# Pruebas E2E (caja negra) con Cypress

Suite automatizada del menú **Punto de venta**. Corre el frontend en el navegador (`npm run dev`) y simula el runtime de Tauri.

## Cómo ejecutar

```bash
npm install
npx cypress install   # solo si npm bloqueó el postinstall de Cypress
npm run e2e           # levanta Vite en :1420, corre la suite headless y apaga el servidor
npm run e2e:open      # modo interactivo (antes hay que levantar `npm run dev` en otra terminal)
```

Una sola spec:

```bash
npx start-server-and-test dev http://localhost:1420 "cypress run --e2e --spec e2e/specs/pos/05-cobro.cy.ts"
```

Los videos y las capturas de fallos quedan en `e2e/reports/`. Esa carpeta no se sube a git; las evidencias se suben a Drive con la convención `S<sprint>_<tipo>_<id>_<descripcion>`.

## Integración con Qase TestOps

Los resultados se envían a Qase con `cypress-qase-reporter`. **Si no hay variables de entorno de Qase, el reporte está apagado** y la suite corre igual, solo en local.

**Estado actual:** proyecto **QLP** («QA - Libreria POS»). Los 71 casos automatizados ya existen (QLP-12 a QLP-82) bajo la suite «Punto de venta · E2E Cypress», y su mapeo está en `qase/case-ids.json`. Además, en `links` hay casos manuales del equipo que también reciben el resultado de su prueba equivalente:

| Caso manual | Pruebas automatizadas que lo alimentan |
|---|---|
| QLP-1 Carga inicial | TC-POS-001 a 005 |
| QLP-7 Búsqueda de producto por nombre | TC-POS-007 |
| QLP-8 Incorporación de producto al carrito | TC-POS-030 |
| QLP-11 Disminución de stock después de una venta | TC-POS-044 |

Para enlazar otro caso manual, agrega `"<código>": [<id>]` en `links`.

### 1. Crear los casos en Qase (una sola vez)

El catálogo se arma con los specs: cada `it(tc("TC-POS-### …"))` o `it(tc("H-## …"))` es un caso y cada spec es una suite. Los 71 casos quedan dentro de la suite padre «Punto de venta · E2E Cypress».

```bash
npm run qase:dry     # revisa el catálogo; no llama a la API
```

En PowerShell, con el token de **Qase → Settings → API tokens**:

```powershell
$env:QASE_TESTOPS_PROJECT = "CODIGO"      # código del proyecto en Qase
$env:QASE_TESTOPS_API_TOKEN = "<token>"   # nunca en el repo
npm run qase:sync
```

El script crea las suites y los casos (marcados como automatizados) y guarda el mapeo código → ID en `qase/case-ids.json`. **Ese archivo sí se sube a git**: los IDs no son secretos y los necesita todo el equipo. Se puede volver a correr sin problema, porque los códigos que ya tienen ID no se duplican. Al agregar tests nuevos, basta con volver a correrlo.

Alternativa sin API: `npm run qase:csv` genera `e2e/reports/qase-casos.csv` para importarlo desde la interfaz de Qase.

### 2. Ejecutar la suite reportando a Qase

Una sola vez por máquina, guarda el proyecto y el token en tu usuario de Windows (en una terminal nueva ya quedan disponibles):

```powershell
setx QASE_TESTOPS_PROJECT "QLP"
setx QASE_TESTOPS_API_TOKEN "<token>"
```

Luego, en cada ejecución que deba reportar:

```powershell
$env:QASE_MODE = "testops"
npm run e2e
```

Cada ejecución crea un *test run* «Cypress E2E · Punto de venta · fecha». El estado de cada caso se registra (pasado/fallido) y se adjuntan videos y capturas. El run se cierra solo al terminar. Para probar sin enviar nada, `QASE_MODE=report` escribe los resultados en `build/qase-report/`.

Las hipótesis H-## aparecen **fallidas** mientras el defecto exista. Ese es el comportamiento esperado: son la evidencia del bug.

## Cómo funciona la simulación de Tauri

En el navegador no existe `window.__TAURI_INTERNALS__`. `support/tauri-mock.ts` lo instala antes de que cargue la app y responde así:

| Comando IPC | Respuesta |
|---|---|
| `plugin:sql\|load/execute/select/close` | SQLite real en memoria (sql.js). El esquema se crea con las **migraciones de `src-tauri/src/lib.rs`** |
| `plugin:updater\|check` | `null` (sin actualizaciones) |
| `plugin:app\|version` | `0.0.0-e2e` |
| otros | error controlado (la app los ignora) |

Cada prueba arranca con una BD nueva: los 3 productos de la migración v2 y los de `fixtures/productos.json`, que cubren los estados de stock normal, bajo y agotado. Los tests pueden consultar la BD con `cy.dbSelect(sql)` para verificar ventas, ítems y movimientos de stock.

**Limitación:** no se prueba el binario de Tauri ni el plugin SQL de Rust. Lo que se valida es la UI y el SQL de `src/services/db.ts` contra el esquema real.

## Estructura

```
e2e/
├── fixtures/productos.json      datos de prueba
├── qase/
│   ├── sync-cases.mjs           da de alta los casos en Qase (o exporta CSV)
│   └── case-ids.json            mapeo TC-POS-### / H-## → ID de Qase
├── support/
│   ├── tauri-mock.ts            simulación del IPC de Tauri
│   ├── commands.ts              cy.visitApp, cy.addToCart, cy.scanBarcode, cy.dbSelect…
│   └── qase.ts                  tc(): enlaza cada test con su caso en Qase
└── specs/pos/
    ├── 01-carga.cy.ts           TC-POS-001..006  pantalla inicial, alertas de stock
    ├── 02-busqueda-filtros.cy.ts TC-POS-007..017 búsqueda y filtro por categorías
    ├── 03-unidad-venta.cy.ts    TC-POS-018..029  unidad y cantidad (valores límite, clases de equivalencia)
    ├── 04-carrito.cy.ts         TC-POS-030..038  carrito y totales
    ├── 05-cobro.cy.ts           TC-POS-039..053  cobro, recibo, stock, métodos de pago (tabla de decisión, transición de estados)
    ├── 06-escaner.cy.ts         TC-POS-054..059  lector de código de barras
    ├── 07-responsive.cy.ts      TC-POS-060..063  pantalla angosta
    └── 99-hallazgos.cy.ts       H-01..H-07       hipótesis de defectos
```

## Hipótesis de defectos (`99-hallazgos.cy.ts`)

Estas pruebas afirman el comportamiento **esperado**. Si una falla, el defecto se reprodujo en el frontend. Según la guía del equipo:

1. Reproducirlo a mano en el instalador **v0.4.0**.
2. Registrarlo como Issue `BUG-###` con la evidencia de Cypress.
3. Renombrar la prueba como `[BUG-###] …`. La prueba se deja fallando hasta que se publique el fix.

El comportamiento esperado de cada hipótesis debe confirmarlo el Product Owner.

Resultado de la ejecución del 2026-10-01 (frontend con la BD simulada; falta reproducirlas en v0.4.0):

| ID | Hipótesis | Resultado | Observado |
|---|---|---|---|
| H-01 | El «+» del carrito no supera el stock | Falla | Tijera (stock 4) llega a 5 en el carrito |
| H-02 | Dos agregados del mismo producto no superan el stock | Falla | El modal solo compara la cantidad nueva con el stock, sin contar lo que ya está en el carrito |
| H-03 | Una venta no deja stock negativo | Falla | El stock queda en −1 |
| H-04 | El lector no agrega productos agotados | Falla | Agrega «Borrador blanco» (stock 0) sin aviso |
| H-05 | No se cobra en efectivo si lo recibido es menor al total | Falla | Muestra «Faltan Q5.00», pero «Cobrar» sigue habilitado |
| H-06 | La transferencia exige código de autorización | Falla | Se cobra con el código vacío |
| H-07 | El foco vuelve al buscador tras agregar | Falla | El foco no queda en el buscador |
| H-08 | «Ganancias de hoy» incluye ventas cerca de la medianoche | Falla | `created_at` se guarda en UTC y el filtro usa la fecha local: entre las 18:00 y las 23:59 (UTC−6) la venta no cuenta en el día. En una máquina con zona UTC esta prueba se omite |

## Selectores

La app todavía no tiene `data-testid`, así que los tests usan textos visibles en español, placeholders e ids (`#qty`, `#cash`, `#ref`, `#notes`). Si cambian los textos de `src/i18n/locales/es.ts`, hay que actualizar los tests. Agregar `data-testid` en kebab-case (por ejemplo `pos-search-input`) haría la suite más estable.
