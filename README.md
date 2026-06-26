# Librería POS

Aplicación de escritorio para **punto de venta (POS) e inventario** de una
librería en Guatemala. Funciona sin conexión: toda la información se guarda en
una base de datos SQLite local embebida.

> El objetivo de despliegue es **Windows**, pero la app es multiplataforma
> (Tauri). El desarrollo y las pruebas funcionan igual en macOS y Linux.

## Concepto clave: unidades dinámicas

Un producto se **compra** en bloque (p. ej. una resma de 500 hojas) pero se
puede **vender** de varias formas con distintos precios:

- **Unidad base** → cómo se compra/almacena (`resma`, `caja`, `unidad`).
- **Unidades de venta** → cómo se vende (`hoja` a Q0.25, `4 hojas` a Q1.00,
  `resma completa` a Q35.00).

El stock siempre se mide en unidades base. Al vender, se descuenta la fracción
correcta: cada unidad de venta define `quantity_in_base_units`, y se descuenta
`quantity_in_base_units × cantidad` del stock.

## Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Shell de escritorio:** Tauri v2 (Rust)
- **Base de datos:** SQLite vía `tauri-plugin-sql`
- **UI:** Tailwind CSS + componentes estilo shadcn/ui
- **Estado:** Zustand
- **Formularios:** React Hook Form + Zod
- **Excel:** SheetJS (`xlsx`) + diálogo de guardado de Tauri

## Requisitos

- Node.js 18+
- Rust (estable) y las dependencias de sistema de Tauri
  (https://v2.tauri.app/start/prerequisites/)

## Comandos

```bash
npm install        # instalar dependencias

npm run tauri:dev  # ejecutar la app de escritorio en modo desarrollo
npm run tauri:build  # generar el instalador (.msi/.exe en Windows)

npm run dev        # solo el frontend en el navegador (sin acceso a SQLite)
npm run build      # compilar el frontend
npm run typecheck  # verificar tipos

npm test           # correr todos los tests (Vitest)
npm run test:watch # tests en modo watch
```

## Tests y CI

Tests unitarios con **Vitest** (+ Testing Library / jsdom) sobre la lógica pura
y los stores: [`calc`](src/lib/calc.ts) (cálculo de venta y stock),
[`utils`](src/lib/utils.ts) (moneda/fechas), [`crypto`](src/lib/crypto.ts)
(hash del PIN), [i18n](src/i18n/i18n.test.ts) (interpolación + paridad es/en),
el [carrito](src/stores/cart.ts) y un render de [`Cart`](src/components/pos/Cart.tsx).

Pipeline en GitHub Actions:

- **PR** → typecheck + tests **solo de archivos modificados** (`vitest --changed`).
- **Merge a `main`** → todos los tests + build, y crea un **release en borrador**.
- **Publicar el release** → compila, firma y distribuye los instaladores.

Detalles en [DISTRIBUTION.md](DISTRIBUTION.md).

> En la primera ejecución se crean las tablas (migración v1) y se cargan
> 3 productos de ejemplo (migración v2) que demuestran las unidades dinámicas.

## Pantallas

1. **Punto de venta** (inicio) — búsqueda con autocompletado, filtro de
   categorías por **menú desplegable con checkboxes** (multi-selección), lector
   de código de barras (USB HID), selección de unidad/cantidad, carrito, cobro y
   recibo. Al cobrar se puede registrar un **cliente** (autocompletado; se crea
   si no existe) y, para transferencias, un **código de autorización**. En
   ventanas angostas el carrito se vuelve un panel deslizable.
2. **Inventario** — tabla de productos con **alertas centralizadas de stock**
   (advertencia si es bajo, error si está agotado), filtro por categoría y
   "solo stock bajo", alta/edición con múltiples unidades de venta,
   reabastecimiento y ajuste de stock.
3. **Ventas** — historial con filtros por fecha (hoy / semana / mes / rango),
   columna de cliente, detalle por venta (cliente, código de autorización, notas)
   y exportación a Excel.
4. **Configuración** — idioma (es/en), tema (claro/oscuro/sistema), moneda,
   **métodos de pago** (efectivo / transferencia), nombre del negocio (que
   aparece en la barra lateral), ubicación de los datos + abrir carpeta,
   respaldos `.db`, exportaciones a Excel, bloqueo opcional con contraseña/PIN y
   actualizaciones.

> Las entradas monetarias muestran el símbolo de moneda como prefijo. Las
> alertas de stock están centralizadas en [`src/lib/stock.ts`](src/lib/stock.ts)
> y se reflejan en POS, Inventario y la barra lateral.

## Internacionalización, tema y bloqueo

- **Idiomas:** español (por defecto) e inglés. Cambialo en Configuración; los
  textos, fechas y moneda se adaptan. Un diccionario por idioma en
  [`src/i18n/locales/es.ts`](src/i18n/locales/es.ts) y
  [`en.ts`](src/i18n/locales/en.ts) (`es.ts` es la fuente de verdad de las
  claves; `en.ts` está tipado para fallar en compilación si falta alguna).
- **Tema:** claro, oscuro o "sistema" (sigue al SO). Se guarda localmente.
- **Bloqueo:** contraseña/PIN opcional que se pide al abrir la app
  (protección básica, no cifra los datos).
- **Guía:** se muestra al primer uso y se puede reabrir desde Configuración o
  la barra lateral.

## Distribución y actualizaciones

La app usa el **updater de Tauri + GitHub Releases**: al subir un tag `vX.Y.Z`,
un workflow de CI compila los instaladores firmados y la app se actualiza sola.
El versionado de la base de datos se maneja con migraciones. Ver
[DISTRIBUTION.md](DISTRIBUTION.md) para los pasos de configuración (secretos de
firma, etc.).

## Exportación a Excel

Desde Inventario y Ventas se generan archivos `.xlsx`:

- **Inventario:** productos + hoja de unidades de venta.
- **Ventas:** ventas + detalle de líneas (según el filtro de fecha).
- **Movimientos de stock:** entradas, salidas y ajustes (servicio
  `exportStockMovements`).

## Lector de código de barras

Los lectores USB actúan como teclado. El hook `useBarcodeScanner` detecta
entrada muy rápida (< 50 ms entre teclas) terminada en `Enter`, busca el
producto por código de barras y lo agrega al carrito automáticamente con su
unidad de venta predeterminada.

## Estructura

```
src/
  components/
    pos/         # Punto de venta
    inventory/   # Inventario
    sales/       # Historial de ventas
    shared/      # Sidebar y navegación
    ui/          # Primitivos de UI (button, dialog, input, …)
  hooks/         # useBarcodeScanner, useDebounce
  stores/        # Zustand: cart, app, toast
  services/
    db.ts        # Toda la lógica SQL (CRUD)
    excel.ts     # Exportación a Excel
  types/         # Interfaces que reflejan el esquema
src-tauri/       # Backend Rust + migraciones SQL + configuración
```

## Atajos de teclado

- **Enter** — confirmar en modales (selección de unidad, cobro, reabastecer).
- **Esc** — cerrar modales.
- El campo de búsqueda del POS recupera el foco tras cada acción.
