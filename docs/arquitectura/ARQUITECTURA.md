# Arquitectura general — Librería POS

Documento de referencia de la arquitectura de la aplicación: capas, módulos, dependencias entre ellos, modelo de datos y los flujos principales. Los diagramas están en [Mermaid](https://mermaid.js.org/) y GitHub los renderiza directamente.

> Versión de referencia: baseline **v0.4.0**. Si cambia la estructura de `src/` o el esquema de la base de datos, actualiza este documento en el mismo PR.

## Índice

1. [Visión general](#1-visión-general)
2. [Contexto del sistema](#2-contexto-del-sistema)
3. [Capas](#3-capas)
4. [Módulos y dependencias](#4-módulos-y-dependencias)
5. [Catálogo de módulos](#5-catálogo-de-módulos)
6. [Modelo de datos](#6-modelo-de-datos)
7. [Flujos principales](#7-flujos-principales)
8. [Pruebas y pipeline](#8-pruebas-y-pipeline)
9. [Puntos de atención para QA](#9-puntos-de-atención-para-qa)

---

## 1. Visión general

**Librería POS** es una aplicación de escritorio **offline-first** de punto de venta e inventario para una librería en Guatemala.

| Aspecto | Decisión |
|---|---|
| Shell de escritorio | Tauri v2 (Rust). Sin comandos Rust propios, salvo `keyring_set/get/delete` para el token de Google |
| Frontend | React 18 + TypeScript + Vite, Tailwind, primitivas estilo shadcn/ui |
| Estado | Zustand (`settings` se serializa a mano en `localStorage`) |
| Persistencia | SQLite local (`libreria.db`) vía `@tauri-apps/plugin-sql` |
| Sincronización | Opcional: copia completa del `.db` en Google Drive, "la nube siempre gana" |
| Actualizaciones | `tauri-plugin-updater` contra GitHub Releases |
| Destino | Windows (desarrollo y pruebas en macOS/Linux) |

Principios:

- **Todo el SQL vive en `src/services/db.ts`.** Los componentes nunca arman consultas.
- **La lógica de negocio pura vive en `src/lib/`** (cálculos, stock, texto) y no depende de Tauri, así que se prueba directamente.
- **Los servicios envuelven las APIs de Tauri** (`plugin-sql`, `plugin-fs`, `plugin-http`, etc.), y en las pruebas se reemplazan con `vi.mock`.

---

## 2. Contexto del sistema

```mermaid
flowchart LR
    user(["Cajero / Encargado"])

    subgraph PC["PC de la tienda (Windows)"]
        subgraph Tauri["Proceso Tauri"]
            web["WebView<br/>React + TypeScript"]
            rust["Núcleo Rust<br/>plugins + migraciones"]
        end
        db[("libreria.db<br/>SQLite")]
        keyring[["Almacén de credenciales del SO<br/>Windows Credential Manager"]]
        ls[["localStorage<br/>libreria-settings"]]
        files[/"Archivos .xlsx / .db<br/>exportaciones y respaldos"/]
    end

    gauth["Google OAuth<br/>Device Authorization Grant"]
    gdrive["Google Drive<br/>libreria_sync.db"]
    gh["GitHub Releases<br/>latest.json + instaladores"]
    scanner["Lector de código de barras<br/>(teclado HID)"]

    user --> web
    scanner --> web
    web <-->|IPC| rust
    rust <--> db
    rust <--> keyring
    rust --> files
    web <--> ls
    rust <-->|HTTPS| gauth
    rust <-->|HTTPS| gdrive
    rust -->|HTTPS| gh
```

---

## 3. Capas

```mermaid
flowchart TB
    subgraph L1["Presentación — src/components"]
        screens["Pantallas<br/>POS · Inventario · Ventas · Configuración"]
        shared["Compartidos<br/>Sidebar · LockScreen · OnboardingGuide · StockAlerts"]
        ui["Primitivas UI<br/>button · input · dialog · select · money-input ..."]
    end

    subgraph L2["Estado y utilidades de UI"]
        stores["Stores Zustand<br/>app · cart · settings · toast"]
        hooks["Hooks<br/>useBarcodeScanner · useDebounce"]
        i18n["i18n<br/>es (fuente) · en"]
    end

    subgraph L3["Servicios — src/services"]
        dbs["db.ts<br/>todo el SQL"]
        syncs["sync.ts · googleAuth.ts · googleDrive.ts · vault.ts"]
        sys["system.ts · excel.ts · updater.ts"]
    end

    subgraph L4["Dominio puro — src/lib"]
        lib["calc · stock · text · crypto · syncSchema · utils"]
    end

    subgraph L5["Plataforma — Tauri v2"]
        plugins["plugin-sql · fs · dialog · http · opener · updater · process"]
        cmds["Comandos keyring_*"]
    end

    L1 --> L2
    L1 --> L3
    L1 --> L4
    L2 --> L3
    L3 --> L4
    L3 --> L5
```

Regla de dependencia: las capas de arriba dependen de las de abajo. `src/lib` no importa Tauri (la única excepción es `syncSchema.ts`, que lee `app_meta` a través de `db.ts`).

---

## 4. Módulos y dependencias

### 4.1 Grafo de dependencias entre módulos

Generado a partir de los `import` reales del código (se omiten `components/ui`, `i18n`, `lib/utils` y `types`, que usan casi todos los módulos).

```mermaid
flowchart LR
    App["App.tsx"]

    subgraph POS["Módulo POS"]
        POSScreen
        Cart
        SellUnitModal
        CheckoutModal
        CustomerInput
    end

    subgraph INV["Módulo Inventario"]
        InventoryScreen
        ProductFormModal
        RestockModal
    end

    subgraph VEN["Módulo Ventas"]
        SalesScreen
    end

    subgraph CFG["Módulo Configuración"]
        SettingsScreen
        CatalogManager
        DriveSyncSection
        ConnectGoogleModal
        ApplySyncModal
        SetPasswordModal
    end

    subgraph SH["Compartidos"]
        Sidebar
        LockScreen
        StockAlerts
    end

    subgraph ST["Stores"]
        appStore["stores/app"]
        cartStore["stores/cart"]
        settingsStore["stores/settings"]
    end

    subgraph SV["Servicios"]
        db["services/db"]
        sync["services/sync"]
        gAuth["services/googleAuth"]
        gDrive["services/googleDrive"]
        vault["services/vault"]
        system["services/system"]
        excel["services/excel"]
        updater["services/updater"]
    end

    subgraph LB["lib"]
        calc["lib/calc"]
        stock["lib/stock"]
        text["lib/text"]
        crypto["lib/crypto"]
        syncSchema["lib/syncSchema"]
    end

    App --> Sidebar & LockScreen & POSScreen & InventoryScreen & SalesScreen & SettingsScreen & ApplySyncModal
    App --> appStore & settingsStore & sync & updater

    POSScreen --> Cart & SellUnitModal & CheckoutModal & StockAlerts
    POSScreen --> db & cartStore & stock
    CheckoutModal --> CustomerInput & db & cartStore & appStore & settingsStore
    CustomerInput --> db
    Cart --> cartStore

    InventoryScreen --> ProductFormModal & RestockModal & StockAlerts
    InventoryScreen --> db & excel & appStore & stock
    ProductFormModal --> db & settingsStore
    RestockModal --> db & settingsStore

    SalesScreen --> db & excel & settingsStore

    SettingsScreen --> CatalogManager & DriveSyncSection & SetPasswordModal
    SettingsScreen --> system & excel & updater
    CatalogManager --> db
    DriveSyncSection --> sync & settingsStore & ConnectGoogleModal
    ConnectGoogleModal --> sync & settingsStore
    ApplySyncModal --> sync & system & settingsStore
    SetPasswordModal --> settingsStore & crypto
    LockScreen --> settingsStore & crypto
    Sidebar --> appStore & settingsStore
    StockAlerts --> appStore & stock

    appStore --> db
    cartStore --> calc

    db --> calc & stock & text & settingsStore
    sync --> db & system & vault & gAuth & gDrive & syncSchema & settingsStore & cartStore
    syncSchema --> db
    system --> db
```

### 4.2 Dependencias hacia la plataforma (Tauri)

```mermaid
flowchart LR
    db["services/db"] --> sql["@tauri-apps/plugin-sql"]
    system["services/system"] --> fs["plugin-fs"] & dialog["plugin-dialog"] & opener["plugin-opener"] & process["plugin-process"] & path["api/path"]
    excel["services/excel"] --> fs & dialog
    sync["services/sync"] --> fs & process
    gAuth["services/googleAuth"] --> http["plugin-http"]
    gDrive["services/googleDrive"] --> http
    vault["services/vault"] --> core["api/core invoke"]
    updater["services/updater"] --> upd["plugin-updater"] & process & app["api/app"]
    ConnectGoogleModal --> opener

    core --> keyring["Rust: keyring_set / keyring_get / keyring_delete"]
```

### 4.3 Observaciones del grafo

- **`services/db` es el punto central**: lo usan las cuatro pantallas, `stores/app`, `sync`, `system` y `syncSchema`. Cualquier cambio en `db.ts` tiene impacto amplio y está cubierto por `db.test.ts` con SQLite real (sql.js).
- **`db` depende de `stores/settings`** solo para `markDirty()`: cada escritura marca `syncPending = true` para que el siguiente tick de sincronización suba los cambios.
- **`sync` depende de `stores/cart`** para no interrumpir una venta en curso (si el carrito tiene artículos, no ofrece aplicar cambios remotos).
- **`i18n` depende de `stores/settings`** (idioma activo) y `stores/settings` depende de `i18n/translations` (tipo de idioma). Es un ciclo solo de tipos y valores por defecto, no de lógica.

---

## 5. Catálogo de módulos

### 5.1 Pantallas (presentación)

| Módulo | Archivos | Responsabilidad | Servicios que usa |
|---|---|---|---|
| **POS** | `components/pos/*` | Buscar productos (texto, categoría, código de barras), elegir unidad de venta, carrito, cobro, recibo | `db` (búsqueda, `completeSale`, clientes), `stores/cart` |
| **Inventario** | `components/inventory/*` | Alta/edición de productos y unidades de venta, reabastecimiento, ajuste de stock, exportar a Excel | `db`, `excel` |
| **Ventas** | `components/sales/SalesScreen.tsx` | Historial paginado, filtros por fecha, resumen y segmentos, detalle de venta, exportar | `db`, `excel` |
| **Configuración** | `components/settings/*` | Tienda, idioma, tema, moneda, métodos de pago, PIN, catálogos (categorías/clientes), respaldo/restauración, Google Drive, actualizaciones | `system`, `excel`, `updater`, `sync`, `db` |
| **Compartidos** | `components/shared/*` | Navegación (Sidebar), bloqueo por PIN, guía de primer uso, badges de alertas de stock | `stores/app`, `stores/settings`, `lib/crypto`, `lib/stock` |

### 5.2 Stores (`src/stores`)

| Store | Estado | Persistencia |
|---|---|---|
| `app` | Pantalla activa, sidebar colapsado, conteo de alertas de stock (`refreshStockAlerts`) | No |
| `cart` | Líneas de la venta en curso; fusiona producto + unidad repetidos | No |
| `settings` | Idioma, tema, moneda, tienda, PIN (hash), métodos de pago, onboarding, metadatos de Drive (`deviceId`, `driveFileId`, `syncPending`, último sync) | `localStorage` → `libreria-settings` |
| `toast` | Notificaciones efímeras | No |
| `useSyncUiStore` (en `services/sync.ts`) | Cambio remoto pendiente, bloqueo por esquema | No |

### 5.3 Servicios (`src/services`)

| Servicio | Responsabilidad |
|---|---|
| `db.ts` | Conexión memoizada (`getDb`), CRUD de productos, unidades, categorías, clientes; `completeSale`, `restockProduct`, `adjustStock`; consultas de ventas, resúmenes y movimientos |
| `sync.ts` | Orquesta Google Drive: conectar, adoptar remoto, subir inicial, `runSyncTick`, aplicar/posponer cambio remoto, loop cada 5 min |
| `googleAuth.ts` | OAuth Device Authorization Grant: código de dispositivo, polling, refresh de token |
| `googleDrive.ts` | Buscar, leer metadatos, subir y descargar `libreria_sync.db` (con `appProperties`) |
| `vault.ts` | Guarda/lee/borra el refresh token en el keyring del SO |
| `system.ts` | Ruta de la base, abrir carpeta de datos, respaldo y restauración del `.db` |
| `excel.ts` | Exportar inventario, ventas, movimientos y reporte general a `.xlsx` |
| `updater.ts` | Versión actual, buscar e instalar actualizaciones |

### 5.4 Dominio puro (`src/lib`)

| Módulo | Responsabilidad |
|---|---|
| `calc.ts` | Subtotales, total y ganancia del carrito, `stockDeducted = quantity_in_base_units × cantidad`, `stockAfter` |
| `stock.ts` | Clasificación única `ok / low / out` y conteos (`stockStatus`, `countStock`) |
| `text.ts` | Normalización de texto y búsqueda difusa (sin acentos, minúsculas) |
| `crypto.ts` | Hash y verificación del PIN |
| `syncSchema.ts` | `CURRENT_SCHEMA_VERSION` y lectura de `app_meta.schema_version` |
| `utils.ts` | `cn`, formato de moneda, stock y fechas |

---

## 6. Modelo de datos

Esquema vigente después de la migración v6 (definido en `src-tauri/src/lib.rs`). Todas las PK son UUID (`TEXT`) desde v5.

```mermaid
erDiagram
    products ||--o{ sell_units : "se vende en"
    products ||--o{ sale_items : "aparece en"
    products ||--o{ stock_movements : "registra"
    sell_units ||--o{ sale_items : "unidad vendida"
    sales ||--|{ sale_items : "contiene"
    customers |o--o{ sales : "compra"

    products {
        text id PK
        text name
        text barcode UK
        text category
        text base_unit_name
        real base_unit_quantity
        real purchase_price
        real stock "en unidades base"
        real min_stock
    }
    sell_units {
        text id PK
        text product_id FK
        text name
        real quantity_in_base_units
        real sell_price
        int is_default
    }
    sales {
        text id PK
        int sale_number "número visible"
        real total
        text payment_method
        text payment_reference
        text customer_id FK
        text customer_name
        text notes
        datetime created_at
    }
    sale_items {
        text id PK
        text sale_id FK
        text product_id FK
        text sell_unit_id FK
        text product_name "copia histórica"
        text sell_unit_name "copia histórica"
        int quantity
        real unit_price
        real subtotal
        real cost_total
    }
    stock_movements {
        text id PK
        text product_id FK
        text type "sale | purchase | adjustment"
        real quantity "negativo en ventas"
        text reference_id "sale.id si aplica"
        text notes
    }
    customers {
        text id PK
        text name UK
    }
    app_meta {
        text key PK
        text value "schema_version"
    }
```

**Concepto clave — unidades de venta dinámicas:** el stock siempre se guarda en la unidad base (p. ej. resma). Cada `sell_unit` declara cuántas unidades base representa (hoja = 1/500, paquete de 4 = 4/500, resma = 1). Al vender se descuenta `quantity_in_base_units × cantidad`.

---

## 7. Flujos principales

### 7.1 Arranque de la aplicación

```mermaid
sequenceDiagram
    autonumber
    participant OS as Windows
    participant R as Tauri (Rust)
    participant DB as SQLite
    participant UI as App.tsx
    participant S as stores/settings
    participant SY as services/sync

    OS->>R: Abrir aplicación
    R->>DB: Precargar sqlite:libreria.db
    R->>DB: Ejecutar migraciones pendientes (v1..v6)
    R->>UI: Cargar WebView
    UI->>S: Leer libreria-settings de localStorage
    alt PIN activado
        UI->>UI: Mostrar LockScreen
        UI->>UI: verifyPassword(PIN) → desbloquear
    end
    UI->>DB: refreshStockAlerts() (countStockAlerts)
    UI->>UI: checkForUpdate() silencioso → toast si hay versión nueva
    opt Primer uso
        UI->>UI: Mostrar OnboardingGuide
    end
    UI->>SY: runSyncTick() + startSyncLoop(5 min)
    Note over UI,SY: La sincronización solo arranca después de desbloquear
```

### 7.2 Registrar una venta (POS)

```mermaid
sequenceDiagram
    autonumber
    actor C as Cajero
    participant P as POSScreen
    participant M as SellUnitModal
    participant K as stores/cart
    participant CO as CheckoutModal
    participant D as services/db
    participant A as stores/app

    C->>P: Busca producto (texto / categoría)
    P->>D: searchProductsWithUnits(query)
    D-->>P: Productos con unidades
    C->>P: Selecciona producto
    P->>M: Abrir selector de unidad y cantidad
    M->>K: addItem(producto, unidad, cantidad)
    Note over K: Si ya existe producto+unidad, suma la cantidad
    C->>CO: Cobrar
    CO->>CO: Elegir método de pago, cliente, efectivo recibido
    CO->>D: completeSale(carrito, meta)
    D->>D: findOrCreateCustomer (si hay nombre)
    D->>D: sale_number = MAX(sale_number) + 1
    D->>D: INSERT sales
    loop Por cada línea
        D->>D: INSERT sale_items (con cost_total)
        D->>D: UPDATE products.stock -= stockDeducted
        D->>D: INSERT stock_movements (type = sale, cantidad negativa)
    end
    D->>D: markDirty() → settings.syncPending = true
    D-->>CO: { saleNumber, total }
    CO->>K: clear()
    CO->>A: refreshStockAlerts()
    CO-->>C: Recibo + vuelto + toast de éxito
```

### 7.3 Escaneo de código de barras

```mermaid
flowchart TD
    A["useBarcodeScanner detecta ráfaga de teclas + Enter"] --> B{"¿Hay modal abierto?<br/>(unidad o cobro)"}
    B -- Sí --> X["Ignorar"]
    B -- No --> C["db.getProductByBarcode(código)"]
    C --> D{"¿Producto existe?"}
    D -- No --> E["toast warning: sin coincidencia"]
    D -- Sí --> F{"¿Tiene unidades de venta?"}
    F -- No --> G["toast error: sin unidades"]
    F -- Sí --> H["Unidad = la marcada por defecto,<br/>si no, la primera"]
    H --> I["cart.addItem(producto, unidad, 1)"]
    I --> J["toast success + limpiar búsqueda"]
```

### 7.4 Inventario: reabastecer y ajustar stock

```mermaid
flowchart LR
    subgraph Reabastecer["RestockModal → restockProduct"]
        r1["Cantidad en unidades base<br/>+ precio de compra opcional"] --> r2["UPDATE products<br/>stock += cantidad<br/>(y purchase_price si se dio)"]
        r2 --> r3["INSERT stock_movements<br/>type = purchase"]
    end
    subgraph Ajustar["adjustStock"]
        a1["Nuevo stock exacto"] --> a2["Leer stock actual<br/>delta = nuevo - actual"]
        a2 --> a3["UPDATE products.stock = nuevo"]
        a3 --> a4["INSERT stock_movements<br/>type = adjustment, quantity = delta"]
    end
    r3 --> z["markDirty()"]
    a4 --> z
    z --> y["refreshStockAlerts() → Sidebar / StockAlerts"]
```

### 7.5 Clasificación de stock

```mermaid
flowchart TD
    s["stockStatus(stock, minStock)"] --> q1{"stock ≤ 0"}
    q1 -- Sí --> out["out — agotado (error)"]
    q1 -- No --> q2{"stock ≤ minStock"}
    q2 -- Sí --> low["low — bajo (warning)"]
    q2 -- No --> ok["ok"]
```

Fuente única: `src/lib/stock.ts`. POS, Inventario y Sidebar usan esta misma función.

### 7.6 Conectar Google Drive (primera vez)

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant CG as ConnectGoogleModal
    participant SY as services/sync
    participant GA as googleAuth
    participant V as vault (keyring)
    participant GD as googleDrive

    U->>CG: Conectar Google Drive
    CG->>SY: connectGoogleDrive(onCode)
    SY->>GA: requestDeviceCode()
    GA-->>CG: user_code + URL de verificación
    CG->>U: Mostrar código y abrir navegador (plugin-opener)
    U->>U: Autoriza en accounts.google.com
    loop Polling hasta autorizar o expirar
        SY->>GA: pollForToken()
    end
    GA-->>SY: access_token + refresh_token
    SY->>V: setRefreshToken (Credential Manager)
    SY->>GD: findExistingSyncFile()
    alt Ya existe libreria_sync.db en Drive
        U->>CG: Elegir "usar datos de la nube"
        CG->>SY: adoptRemote(fileId) → descarga, reemplaza .db, reinicia
    else No existe o el usuario elige esta PC
        CG->>SY: pushLocalAsInitial() → sube .db con appProperties
    end
```

### 7.7 Ciclo de sincronización (`runSyncTick`)

Se ejecuta al desbloquear la app, cada 5 minutos y con el botón "Sincronizar ahora". Regla: **la nube siempre gana**, pero el cambio remoto nunca se aplica sin confirmación.

```mermaid
flowchart TD
    start(["runSyncTick"]) --> e{"¿Sync habilitado,<br/>sin tick en curso y<br/>sin cambio pendiente?"}
    e -- No --> fin(["Salir"])
    e -- Sí --> tok{"¿Hay refresh token<br/>en el keyring?"}
    tok -- No --> fin
    tok -- Sí --> meta["Refrescar access token<br/>Leer metadatos del archivo en Drive"]
    meta --> sch{"¿dbSchemaVersion remoto ><br/>CURRENT_SCHEMA_VERSION?"}
    sch -- Sí --> blk["schemaBlocked = true<br/>(pedir actualizar la app)"] --> fin
    sch -- No --> rc{"¿modifiedTime remoto ≠<br/>último sincronizado?"}
    rc -- Sí --> cart{"¿Carrito con artículos?"}
    cart -- Sí --> fin
    cart -- No --> pend["pendingRemoteChange = {...}<br/>→ ApplySyncModal"] --> fin
    rc -- No --> push{"¿syncPending o el esquema<br/>local avanzó?"}
    push -- No --> fin
    push -- Sí --> up["Checkpoint WAL → leer .db<br/>uploadSyncFile con appProperties<br/>syncPending = false"] --> fin
    meta -. "error de red / API" .-> fin
```

### 7.8 Aplicar un cambio remoto

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant AM as ApplySyncModal
    participant SYS as services/system
    participant SY as services/sync
    participant GD as googleDrive

    AM->>U: "Hay cambios de [dispositivo] — ¿aplicar?"
    Note over AM: El botón Aplicar se habilita tras una cuenta regresiva
    alt Aplicar
        opt Casilla "respaldar antes" marcada
            AM->>SYS: backupDatabase()
        end
        AM->>SY: applyPendingRemoteChange()
        SY->>GD: downloadSyncFile()
        SY->>SY: Checkpoint WAL, sobrescribir .db, borrar -wal/-shm
        SY->>SY: Guardar metadatos de último sync
        SY->>SY: relaunch()
    else Ahora no
        AM->>SY: postponePendingRemoteChange()
        Note over SY: Se volverá a ofrecer en el siguiente tick
    end
```

### 7.9 Respaldo y restauración manual

```mermaid
flowchart LR
    subgraph Respaldo
        b1["PRAGMA wal_checkpoint(TRUNCATE)"] --> b2["Diálogo Guardar<br/>respaldo_libreria_FECHA.db"] --> b3["copyFile(libreria.db → destino)"]
    end
    subgraph Restauración
        r1["Diálogo Abrir .db"] --> r2["Checkpoint WAL"] --> r3["copyFile(origen → libreria.db)"] --> r4["Borrar -wal / -shm"] --> r5["relaunch()"]
    end
```

### 7.10 Actualización de la aplicación y release

```mermaid
flowchart LR
    pr["PR con título<br/>feat: / fix:"] --> ci["CI: typecheck + tests<br/>con cobertura<br/>(Ubuntu + Windows)"]
    ci --> merge["Merge a main"]
    merge --> ver["next-version.cjs<br/>calcula bump"]
    ver --> draft["Commit de versión +<br/>Release borrador"]
    draft --> pub["Publicar release"]
    pub --> build["Build firmado<br/>.msi / .exe"]
    build --> json["latest.json en<br/>GitHub Releases"]
    json --> app["App instalada:<br/>checkForUpdate() al iniciar"]
    app --> inst["Configuración → instalar<br/>→ relaunch"]
```

---

## 8. Pruebas y pipeline

```mermaid
flowchart TB
    subgraph Unit["Vitest (caja blanca)"]
        t1["lib · stores · hooks · i18n<br/>pruebas directas"]
        t2["db.test.ts<br/>SQLite en memoria (sql.js)<br/>con migraciones reales de lib.rs"]
        t3["migrations.test.ts<br/>numeración y schema_version"]
        t4["sync · googleAuth · googleDrive<br/>con plugin-http / fs / vault mockeados"]
        t5["Cart.tsx<br/>Testing Library"]
    end
    subgraph E2E["Cypress (caja negra) — e2e/"]
        e1["mockIPC de Tauri o<br/>tauri-driver + Selenium<br/>(se decide en el spike del Sprint 1)"]
    end
    subgraph Excl["Fuera de cobertura"]
        x1["Pantallas (excepto Cart)<br/>system · updater · excel · vault"]
    end
```

| Capa | Cómo se prueba |
|---|---|
| `src/lib`, `src/stores`, `src/hooks`, `src/i18n` | Unitarias directas |
| `src/services/db.ts` | `@tauri-apps/plugin-sql` reemplazado por sql.js con el esquema real |
| `src/services/sync.ts` y Google | Mocks de HTTP, FS, vault y cliente de Drive |
| Pantallas | E2E con Cypress (en construcción) |

---

## 9. Puntos de atención para QA

Características de la arquitectura que conviene cubrir con casos de prueba. No son bugs confirmados; si alguna prueba demuestra un fallo, se registra como `BUG-###` según la guía del equipo.

| Área | Característica | Qué probar |
|---|---|---|
| Venta | `completeSale` ejecuta varios `INSERT`/`UPDATE` secuenciales sin una transacción explícita | Comportamiento si ocurre un error a mitad de una venta con varias líneas |
| Venta | `sale_number` se calcula como `MAX + 1` | Numeración correlativa, también después de restaurar un respaldo o aplicar un sync |
| Stock | La venta descuenta stock sin validar existencia en `db.ts` | Vender más de lo disponible; cómo se ve el stock negativo en POS, Inventario y alertas |
| Unidades | `quantity_in_base_units` es `REAL` | Fracciones (hoja de una resma) y redondeo en stock y costo |
| Sync | La nube gana y reemplaza el `.db` completo | Ventas locales no subidas cuando llega un cambio remoto; confirmación y respaldo previo |
| Sync | Bloqueo por esquema | Archivo remoto con `dbSchemaVersion` mayor al soportado |
| Sync | No interrumpe ventas | Cambio remoto mientras hay artículos en el carrito |
| Seguridad | PIN en `localStorage` como hash; token de Google en el keyring | Que el token no aparezca en `localStorage` ni en archivos |
| Restauración | Reemplazo del `.db` + borrado de `-wal`/`-shm` + reinicio | Restaurar un respaldo con datos y verificar integridad |
| i18n | `en.ts` tipado contra `es.ts` | Textos sin traducir en pantallas nuevas (dashboard v0.5.0) |
