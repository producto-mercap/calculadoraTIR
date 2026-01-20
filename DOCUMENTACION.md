# Documentación Técnica y Funcional - Calculadora TIR

## 📋 Índice

1. [Descripción General](#descripción-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Estructura de Base de Datos](#estructura-de-base-de-datos)
4. [Módulos y Funcionalidades](#módulos-y-funcionalidades)
5. [APIs Externas](#apis-externas)
6. [Endpoints API](#endpoints-api)
7. [Lógica de Negocio](#lógica-de-negocio)
8. [Frontend](#frontend)
9. [Configuración y Despliegue](#configuración-y-despliegue)

---

## Descripción General

**Calculadora TIR** es una aplicación web para calcular la Tasa Interna de Retorno (TIR) de bonos con diferentes tipos de ajuste (CER, TAMAR, BADLAR). La aplicación permite:

- Calcular TIR y generar cashflow de bonos
- Gestionar datos de variables económicas (CER, TAMAR, BADLAR)
- Gestionar días feriados
- Guardar y cargar calculadoras guardadas
- Procesar inventario FIFO desde archivos Excel

### Tecnologías Utilizadas

- **Backend**: Node.js + Express
- **Frontend**: EJS (templates) + JavaScript vanilla
- **Base de Datos**: PostgreSQL (Neon)
- **Hosting**: Vercel
- **Librerías principales**: 
  - `pg` (PostgreSQL)
  - `axios` (HTTP requests)
  - `xlsx` (procesamiento Excel)
  - `multer` (upload de archivos)

---

## Arquitectura del Sistema

### Estructura de Directorios

```
calculadoraTIR/
├── src/
│   ├── app.js                    # Punto de entrada principal
│   ├── config/
│   │   └── database.js           # Configuración de pool de conexiones PostgreSQL
│   ├── controllers/              # Lógica de negocio por módulo
│   │   ├── calculadoraController.js
│   │   ├── cerController.js
│   │   ├── tamarController.js
│   │   ├── badlarController.js
│   │   ├── feriadosController.js
│   │   ├── calculadorasController.js
│   │   ├── inventarioController.js
│   │   ├── inventarioPPProcessor.js
│   │   └── inventarioUtils.js
│   ├── routes/
│   │   ├── indexRoutes.js        # Rutas de páginas (GET)
│   │   └── apiRoutes.js          # Rutas API (GET/POST/PUT/DELETE)
│   ├── services/                 # Servicios externos
│   │   ├── bcraService.js        # API BCRA (CER, TAMAR, BADLAR)
│   │   └── feriadosService.js    # API ArgentinaDatos (Feriados)
│   ├── public/                   # Archivos estáticos
│   │   ├── css/
│   │   │   └── main.css
│   │   ├── js/
│   │   │   ├── main.js
│   │   │   ├── calculadora/
│   │   │   │   ├── calculadoraCER.js
│   │   │   │   ├── cupones/
│   │   │   │   │   ├── autocompletado.js
│   │   │   │   │   ├── calculoCupones.js
│   │   │   │   │   ├── calculos.js
│   │   │   │   │   ├── cer.js
│   │   │   │   │   ├── core.js
│   │   │   │   │   ├── dayCountFactor.js
│   │   │   │   │   ├── diasHabiles.js
│   │   │   │   │   ├── fechas.js
│   │   │   │   │   ├── recalculos.js
│   │   │   │   │   ├── tir.js
│   │   │   │   │   └── validaciones.js
│   │   │   │   └── precios.js
│   │   │   ├── cer.js
│   │   │   ├── tamar.js
│   │   │   ├── badlar.js
│   │   │   ├── feriados.js
│   │   │   ├── inventario.js
│   │   │   ├── calculadoraStorage.js
│   │   │   └── utils/
│   │   │       ├── calculosFinancieros.js
│   │   │       ├── dateUtils.js
│   │   │       └── formUtils.js
│   │   └── images/
│   └── views/                    # Templates EJS
│       ├── layouts/
│       │   └── main.ejs
│       ├── pages/
│       │   ├── calculadora.ejs
│       │   ├── cer.ejs
│       │   ├── tamar.ejs
│       │   ├── badlar.ejs
│       │   ├── feriados.ejs
│       │   ├── inventario.ejs
│       │   └── 404.ejs
│       └── partials/
│           └── header.ejs
├── Database/                     # Scripts SQL (si existen)
├── package.json
├── vercel.json                   # Configuración Vercel
└── .env                          # Variables de entorno (no versionado)
```

### Flujo de Datos

1. **Usuario** → Interactúa con la interfaz (EJS)
2. **Frontend (JS)** → Realiza peticiones AJAX a `/api/*`
3. **Backend (Express)** → Procesa en `controllers/`
4. **Servicios** → Consultan APIs externas o BD
5. **Base de Datos** → Almacena datos persistentes
6. **Respuesta** → JSON o renderizado EJS

---

## Estructura de Base de Datos

### Tabla: `variables`

Almacena datos históricos de variables económicas (CER, TAMAR, BADLAR).

**Columnas:**
- `fecha` (DATE, PRIMARY KEY) - Fecha del valor
- `valor` (NUMERIC/DECIMAL) - Valor de la variable
- `id_variable` (INTEGER, PRIMARY KEY) - ID de la variable:
  - `30` = CER
  - `44` = TAMAR
  - `7` = BADLAR

**Índices:**
- PRIMARY KEY: `(fecha, id_variable)`
- Índice en `id_variable` para consultas rápidas

**Operaciones:**
- **INSERT**: `INSERT INTO variables (fecha, valor, id_variable) VALUES ... ON CONFLICT DO UPDATE`
- **SELECT**: `SELECT fecha, valor, id_variable FROM variables WHERE id_variable = ? AND fecha BETWEEN ? AND ?`

### Tabla: `feriados`

Almacena días feriados de Argentina.

**Columnas:**
- `fecha` (DATE, PRIMARY KEY) - Fecha del feriado
- `nombre` (VARCHAR/TEXT) - Nombre del feriado (ej: "Día de la Independencia")
- `tipo` (VARCHAR/TEXT) - Tipo de feriado (ej: "inamovible", "trasladable")

**Índices:**
- PRIMARY KEY: `fecha`

**Operaciones:**
- **INSERT**: `INSERT INTO feriados (fecha, nombre, tipo) VALUES ... ON CONFLICT DO UPDATE`
- **SELECT**: `SELECT fecha, nombre, tipo FROM feriados WHERE fecha BETWEEN ? AND ? ORDER BY fecha`

### Tabla: `calculadoras`

Almacena calculadoras guardadas por el usuario.

**Columnas:**
- `id` (SERIAL, PRIMARY KEY) - ID único
- `nombre` (VARCHAR) - Nombre descriptivo de la calculadora
- `fecha_compra` (DATE) - Fecha de compra del bono
- `precio_compra` (NUMERIC) - Precio de compra
- `cantidad_partida` (NUMERIC) - Cantidad de la partida
- `ticker` (VARCHAR) - Ticker del bono
- `tasa` (NUMERIC) - Tasa del bono
- `formula` (VARCHAR) - Fórmula de cálculo
- `renta_tna` (NUMERIC) - Renta TNA
- `spread` (NUMERIC) - Spread
- `tipo_interes_dias` (INTEGER) - Tipo de interés por días (0-4)
- `fecha_emision` (DATE) - Fecha de emisión
- `fecha_primer_pago` (DATE) - Fecha del primer pago
- `fecha_primera_renta` (VARCHAR) - Día de pago (ej: "15", "15/30")
- `dias_restar_fecha_fin_dev` (INTEGER) - Días a restar de fecha fin de devengamiento
- `fecha_amortizacion` (DATE) - Fecha de amortización
- `porcentaje_amortizacion` (NUMERIC) - Porcentaje de amortización
- `periodicidad` (VARCHAR) - Periodicidad de pagos
- `intervalo_inicio` (INTEGER) - Intervalo inicio
- `intervalo_fin` (INTEGER) - Intervalo fin
- `ajuste_cer` (BOOLEAN) - Si tiene ajuste CER
- `fecha_creacion` (TIMESTAMP) - Fecha de creación
- `fecha_actualizacion` (TIMESTAMP, opcional) - Fecha de última actualización

**Operaciones:**
- **INSERT**: `INSERT INTO calculadoras (...) VALUES (...) RETURNING id, nombre, fecha_creacion`
- **UPDATE**: `UPDATE calculadoras SET ... WHERE id = ? RETURNING ...`
- **DELETE**: `DELETE FROM calculadoras WHERE id = ?`
- **SELECT**: `SELECT * FROM calculadoras ORDER BY fecha_creacion DESC`

---

## Módulos y Funcionalidades

### 1. Calculadora TIR (`/calculadora`)

**Controlador**: `calculadoraController.js`

**Funcionalidad:**
- Calcula la TIR de bonos basándose en datos de partida y especie
- Genera cashflow de cupones
- Soporta diferentes tipos de ajuste (CER, TAMAR, BADLAR)
- Calcula fracciones de año según diferentes convenciones (30/360, Actual/365, etc.)

**Archivos Frontend:**
- `public/js/calculadora/calculadoraCER.js` - Lógica principal
- `public/js/calculadora/cupones/` - Módulos de cupones:
  - `core.js` - Funciones core
  - `tir.js` - Cálculo de TIR (método Newton-Raphson)
  - `calculoCupones.js` - Cálculo de cupones
  - `cer.js` - Ajuste por CER
  - `fechas.js` - Manejo de fechas
  - `diasHabiles.js` - Cálculo de días hábiles
  - `dayCountFactor.js` - Factores de conteo de días
  - `validaciones.js` - Validaciones de datos
  - `recalculos.js` - Recalculos automáticos

**Lógica de Cálculo:**
1. Usuario ingresa datos de partida (fecha compra, precio, cantidad)
2. Usuario ingresa datos de especie (ticker, tasa, fechas, etc.)
3. Sistema calcula cupones según periodicidad y fechas
4. Sistema aplica ajustes (CER, TAMAR, BADLAR) si corresponde
5. Sistema calcula TIR usando método iterativo (Newton-Raphson)
6. Sistema genera cashflow con flujos descontados

**Guardado en BD:**
- Tabla: `calculadoras`
- Endpoint: `POST /api/calculadoras/guardar`
- Carga: `GET /api/calculadoras/:id`

### 2. Gestión CER (`/cer`)

**Controlador**: `cerController.js`

**Funcionalidad:**
- Consulta datos de CER desde API BCRA
- Guarda datos en BD para uso offline
- Visualiza datos paginados
- Exporta a CSV (frontend)

**Tabla BD**: `variables` (id_variable = 30)

**Endpoints:**
- `GET /cer` - Renderiza página
- `GET /api/cer?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` - Obtiene desde API BCRA
- `POST /api/cer/guardar` - Guarda en BD
- `GET /api/cer/bd?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` - Obtiene desde BD
- `GET /api/cer/exportar` - Exporta CSV (stub, se hace en frontend)

**Flujo:**
1. Usuario selecciona rango de fechas
2. Sistema consulta API BCRA (`bcraService.obtenerCER`)
3. Usuario puede guardar datos en BD
4. Sistema muestra datos paginados (50 por página)

### 3. Gestión TAMAR (`/tamar`)

**Controlador**: `tamarController.js`

**Funcionalidad:**
- Similar a CER pero para TAMAR
- Consulta API BCRA variable 44

**Tabla BD**: `variables` (id_variable = 44)

**Endpoints:**
- `GET /tamar` - Renderiza página
- `GET /api/tamar?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` - Obtiene desde API BCRA
- `POST /api/tamar/guardar` - Guarda en BD
- `GET /api/tamar/bd?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` - Obtiene desde BD
- `GET /api/tamar/exportar` - Exporta CSV

### 4. Gestión BADLAR (`/badlar`)

**Controlador**: `badlarController.js`

**Funcionalidad:**
- Similar a CER pero para BADLAR
- Consulta API BCRA variable 7

**Tabla BD**: `variables` (id_variable = 7)

**Endpoints:**
- `GET /badlar` - Renderiza página
- `GET /api/badlar?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` - Obtiene desde API BCRA
- `POST /api/badlar/guardar` - Guarda en BD
- `GET /api/badlar/bd?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` - Obtiene desde BD
- `GET /api/badlar/exportar` - Exporta CSV

### 5. Gestión Feriados (`/feriados`)

**Controlador**: `feriadosController.js`

**Funcionalidad:**
- Consulta feriados desde API ArgentinaDatos
- Guarda feriados en BD
- Permite agregar feriados manualmente
- Visualiza datos paginados

**Tabla BD**: `feriados`

**Endpoints:**
- `GET /feriados` - Renderiza página
- `GET /api/feriados?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` - Obtiene desde API
- `GET /api/feriados/:anio` - Obtiene feriados de un año específico
- `POST /api/feriados/guardar` - Guarda múltiples feriados en BD
- `POST /api/feriados/nuevo` - Guarda un feriado individual
- `GET /api/feriados/bd?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` - Obtiene desde BD (con paginación opcional)

**Flujo:**
1. Usuario selecciona rango de fechas o año
2. Sistema consulta API ArgentinaDatos (`feriadosService.obtenerFeriados` o `obtenerFeriadosRango`)
3. Usuario puede guardar en BD
4. Sistema muestra datos paginados

### 6. Inventario FIFO (`/inventario`)

**Controlador**: `inventarioController.js`

**Funcionalidad:**
- Procesa archivos Excel con movimientos de inventario
- Aplica lógica FIFO (First In, First Out)
- Clasifica movimientos por categorías (A-L)
- Calcula saldos de partidas

**Archivos Auxiliares:**
- `inventarioPPProcessor.js` - Procesamiento especial de movimientos PP
- `inventarioUtils.js` - Utilidades para cálculo de saldos y categorías

**Endpoints:**
- `GET /inventario` - Renderiza página
- `POST /api/inventario/procesar` - Procesa archivo Excel (multipart/form-data)

**Formato Excel Esperado:**
Columnas: `TIPO_MIN`, `TIPO_MOV`, `MINUTA_ORIGEN`, `CANTIDAD`, `FECHA`

**Lógica FIFO:**
1. Lee archivo Excel
2. Normaliza y valida datos
3. Clasifica movimientos por categorías (A-L) según reglas de negocio
4. Ordena movimientos por fecha y categoría
5. Procesa ingresos: crea nuevas partidas
6. Procesa egresos: aplica FIFO sobre partidas disponibles
7. Calcula saldos finales

**Categorías de Movimientos:**
- **A**: Ingresos contados (INGR, C)
- **B**: Ingresos futuros sin pata presente (OCT, PP, Préstamo, PA, PF)
- **C**: Transferencias de ingreso (TRFU, TRFS, TRFC)
- **D**: Egresos futuros con pata presente misma fecha
- **E**: Ingresos futuros con pata presente misma fecha
- **F**: Demás ingresos
- **G**: Egresos futuros sin pata presente
- **H**: Partidas manuales
- **I**: Bloqueos/Garantías
- **J**: Egresos futuros (PF, PA, OCT sin pata futuro)
- **K**: Egresos contados (Venta, Transferencia, Egreso)
- **L**: Demás egresos
- **M**: Imputaciones manuales

**Reglas Especiales:**
- Movimientos PP requieren procesamiento especial (ver `inventarioPPProcessor.js`)
- Partidas PA solo se impactan con egresos PA del mismo MINUTA_ORIGEN
- Movimientos con misma fecha y MINUTA_ORIGEN se cancelan

---

## APIs Externas

### 1. API BCRA (Banco Central de la República Argentina)

**URL Base**: `https://api.bcra.gob.ar/estadisticas/v4.0`

**Servicio**: `bcraService.js`

**Endpoints Utilizados:**
- `GET /monetarias/30` - Obtener CER
- `GET /monetarias/44` - Obtener TAMAR
- `GET /monetarias/7` - Obtener BADLAR

**Parámetros:**
- `desde` (YYYY-MM-DD) - Fecha desde
- `hasta` (YYYY-MM-DD) - Fecha hasta

**Formato Respuesta:**
```json
{
  "status": 200,
  "results": [
    {
      "idVariable": 30,
      "detalle": [
        {
          "fecha": "2024-01-01",
          "valor": 1234.56
        }
      ]
    }
  ]
}
```

**Características:**
- Consulta por año para evitar timeouts
- Maneja errores 404/500 gracefully
- Filtra datos por rango de fechas
- Elimina duplicados
- Ordena por fecha descendente

**Límites:**
- Fecha mínima: 2020-01-01
- Timeout: 15 segundos por request
- Delay entre requests: 100ms

### 2. API ArgentinaDatos (Feriados)

**URL Base**: `https://api.argentinadatos.com/v1/feriados`

**Servicio**: `feriadosService.js`

**Endpoints Utilizados:**
- `GET /feriados/:anio` - Obtener feriados de un año
- `GET /feriados?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` - Obtener por rango (si existe)

**Rango de Años**: 2016-2025

**Formato Respuesta:**
```json
[
  {
    "fecha": "2024-01-01",
    "tipo": "inamovible",
    "nombre": "Año Nuevo"
  }
]
```

**Características:**
- Consulta por año si se requiere rango
- Maneja errores 404 (retorna array vacío)
- Normaliza formato de fechas
- Filtra por rango de fechas

---

## Endpoints API

### Variables Económicas (CER, TAMAR, BADLAR)

#### Obtener desde API Externa
```
GET /api/cer?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
GET /api/tamar?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
GET /api/badlar?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
```

**Respuesta:**
```json
{
  "success": true,
  "datos": [
    {
      "fecha": "2024-01-01",
      "valor": 1234.56,
      "idVariable": 30
    }
  ]
}
```

#### Guardar en BD
```
POST /api/cer/guardar
POST /api/tamar/guardar
POST /api/badlar/guardar
```

**Body:**
```json
{
  "datos": [
    {
      "fecha": "2024-01-01",
      "valor": 1234.56,
      "idVariable": 30
    }
  ]
}
```

**Respuesta:**
```json
{
  "success": true,
  "actualizados": 100,
  "message": "Se guardaron/actualizaron 100 registros de CER"
}
```

#### Obtener desde BD
```
GET /api/cer/bd?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
GET /api/tamar/bd?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
GET /api/badlar/bd?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
```

**Respuesta:**
```json
{
  "success": true,
  "datos": [
    {
      "fecha": "2024-01-01",
      "valor": 1234.56,
      "idVariable": 30
    }
  ]
}
```

### Feriados

#### Obtener desde API Externa
```
GET /api/feriados?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
GET /api/feriados/:anio
```

**Respuesta:**
```json
{
  "success": true,
  "datos": [
    {
      "fecha": "2024-01-01",
      "tipo": "inamovible",
      "nombre": "Año Nuevo"
    }
  ]
}
```

#### Guardar en BD
```
POST /api/feriados/guardar
POST /api/feriados/nuevo
```

**Body (guardar múltiples):**
```json
{
  "datos": [
    {
      "fecha": "2024-01-01",
      "nombre": "Año Nuevo",
      "tipo": "inamovible"
    }
  ]
}
```

**Body (guardar individual):**
```json
{
  "fecha": "2024-01-01",
  "nombre": "Año Nuevo",
  "tipo": "inamovible"
}
```

#### Obtener desde BD
```
GET /api/feriados/bd?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
GET /api/feriados/bd?pagina=1&porPagina=50
```

**Respuesta:**
```json
{
  "success": true,
  "datos": [
    {
      "fecha": "2024-01-01",
      "nombre": "Año Nuevo",
      "tipo": "inamovible"
    }
  ],
  "pagina": 1,
  "porPagina": 50,
  "total": 100,
  "totalPaginas": 2
}
```

### Calculadoras Guardadas

#### Guardar Calculadora
```
POST /api/calculadoras/guardar
```

**Body:**
```json
{
  "nombre": "Bono TTM26",
  "fechaCompra": "01/01/2024",
  "precioCompra": 100.5,
  "cantidadPartida": 1000,
  "ticker": "TTM26",
  "tasa": 0.05,
  "formula": "CER",
  "rentaTNA": 0.04,
  "spread": 0.01,
  "tipoInteresDias": 0,
  "fechaEmision": "01/01/2020",
  "fechaPrimerPago": "01/07/2024",
  "fechaPrimeraRenta": "15",
  "diasRestarFechaFinDev": 0,
  "fechaAmortizacion": "01/01/2030",
  "porcentajeAmortizacion": 100,
  "periodicidad": "semestral",
  "intervaloInicio": 1,
  "intervaloFin": 20,
  "ajusteCER": true
}
```

**Respuesta:**
```json
{
  "success": true,
  "calculadora": {
    "id": 1,
    "nombre": "Bono TTM26",
    "fecha_creacion": "2024-01-01T00:00:00.000Z"
  },
  "message": "Calculadora guardada exitosamente"
}
```

#### Actualizar Calculadora
```
PUT /api/calculadoras/:id
```

**Body:** Mismo que guardar

#### Eliminar Calculadora
```
DELETE /api/calculadoras/:id
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Calculadora eliminada exitosamente"
}
```

#### Obtener Lista de Calculadoras
```
GET /api/calculadoras
```

**Respuesta:**
```json
{
  "success": true,
  "calculadoras": [
    {
      "id": 1,
      "nombre": "Bono TTM26",
      "fecha_creacion": "2024-01-01T00:00:00.000Z",
      "fecha_actualizacion": "2024-01-02T00:00:00.000Z"
    }
  ]
}
```

#### Cargar Calculadora Específica
```
GET /api/calculadoras/:id
```

**Respuesta:**
```json
{
  "success": true,
  "calculadora": {
    "id": 1,
    "nombre": "Bono TTM26",
    "fechaCompra": "01/01/2024",
    "precioCompra": 100.5,
    // ... todos los campos
  }
}
```

### Inventario FIFO

#### Procesar Archivo Excel
```
POST /api/inventario/procesar
Content-Type: multipart/form-data
```

**Form Data:**
- `archivo`: Archivo Excel (.xlsx)
- `fechaLimite` (opcional): DD/MM/AAAA - Fecha límite para procesar movimientos

**Respuesta:**
```json
{
  "success": true,
  "partidas": [
    {
      "id": 1,
      "tipoMin": "C",
      "tipoMov": "I",
      "minutaOrigen": "12345",
      "fecha": "2024-01-01T00:00:00.000Z",
      "fechaStr": "01/01/2024",
      "cantidadInicial": 1000,
      "saldo": 500,
      "cerrada": false,
      "imputaciones": [
        {
          "tipoMin": "V",
          "tipoMov": "E",
          "minutaOrigen": "67890",
          "fecha": "2024-01-15T00:00:00.000Z",
          "fechaStr": "15/01/2024",
          "cantidad": -500,
          "cantidadOriginal": 500,
          "saldoDespues": 500
        }
      ]
    }
  ],
  "errores": [],
  "totalMovimientos": 100,
  "totalPartidas": 50,
  "sumatoriaSaldos": 5000
}
```

---

## Lógica de Negocio

### Cálculo de TIR

**Archivo**: `public/js/calculadora/cupones/tir.js`

**Método**: Newton-Raphson (iterativo)

**Algoritmo:**
1. Recolectar flujos y fechas de cupones
2. Calcular fracciones de año según `tipoInteresDias`:
   - `0` = 30/360 US
   - `1` = 30/360 European
   - `2` = Actual/365
   - `3` = Actual/360
   - `4` = Actual/Actual
3. Función objetivo: `VAN(tasa) = Σ(flujo_i / (1 + tasa)^fraccionAnio_i) - precioCompra = 0`
4. Derivada: `VAN'(tasa) = Σ(-flujo_i * fraccionAnio_i / (1 + tasa)^(fraccionAnio_i + 1))`
5. Iterar: `tasa_nueva = tasa_anterior - VAN(tasa) / VAN'(tasa)`
6. Convergencia cuando `|VAN(tasa)| < 0.0001` o máximo 100 iteraciones

**Precisión**: Usa `Number()` para máxima precisión, evita truncar valores intermedios

### Cálculo de Cupones

**Archivo**: `public/js/calculadora/cupones/calculoCupones.js`

**Proceso:**
1. Calcular fechas de pago según periodicidad y fecha primer pago
2. Ajustar fechas según días hábiles (excluyendo feriados)
3. Calcular días de devengamiento según `diasRestarFechaFinDev`
4. Aplicar ajuste CER si `ajusteCER = true`:
   - Obtener valores CER para fechas relevantes
   - Calcular factor de actualización
   - Aplicar a capital y/o intereses según fórmula
5. Calcular intereses según tasa y spread
6. Calcular amortización si corresponde
7. Generar cashflow con flujos descontados

### Procesamiento FIFO

**Archivo**: `inventarioController.js` + `inventarioUtils.js` + `inventarioPPProcessor.js`

**Algoritmo:**
1. **Lectura**: Leer Excel y normalizar datos
2. **Clasificación**: Clasificar movimientos por categorías (A-L)
3. **Ordenamiento**: Ordenar por fecha, luego por categoría, luego por orden de creación
4. **Procesamiento**:
   - **Ingresos**: Crear nueva partida con `saldo = cantidad`
   - **Egresos**: Aplicar FIFO sobre partidas disponibles:
     - Ordenar partidas por fecha (más antiguas primero)
     - Si misma fecha, ordenar por categoría
     - Aplicar egreso hasta agotar cantidad o partidas
     - Crear imputación en partida afectada
     - Cerrar partida si `saldo = 0`
5. **Reglas Especiales**:
   - Partidas PA solo se impactan con egresos PA del mismo MINUTA_ORIGEN
   - Movimientos PP requieren procesamiento especial (distribución retroactiva)
   - Movimientos con misma fecha y MINUTA_ORIGEN se cancelan

---

## Frontend

### Estructura de Archivos JavaScript

#### Módulo Principal de Calculadora
- `calculadoraCER.js` - Orquestador principal
- `cupones/core.js` - Funciones core de cupones
- `cupones/tir.js` - Cálculo de TIR
- `cupones/calculoCupones.js` - Generación de cupones
- `cupones/cer.js` - Ajuste por CER
- `cupones/fechas.js` - Manejo de fechas
- `cupones/diasHabiles.js` - Cálculo de días hábiles
- `cupones/dayCountFactor.js` - Factores de conteo de días
- `cupones/validaciones.js` - Validaciones
- `cupones/recalculos.js` - Recalculos automáticos

#### Utilidades
- `utils/calculosFinancieros.js` - Funciones financieras (fracción de año, day count)
- `utils/dateUtils.js` - Utilidades de fechas
- `utils/formUtils.js` - Utilidades de formularios

#### Módulos por Solapa
- `cer.js` - Gestión CER
- `tamar.js` - Gestión TAMAR
- `badlar.js` - Gestión BADLAR
- `feriados.js` - Gestión Feriados
- `inventario.js` - Procesamiento Inventario
- `calculadoraStorage.js` - Guardado/Carga de calculadoras

### Almacenamiento Local

**Archivo**: `calculadoraStorage.js`

**Funcionalidad:**
- Guarda estado de calculadora en `localStorage`
- Carga estado al iniciar
- Sincroniza con BD cuando se guarda calculadora

**Clave**: `calculadoraTIR_state`

---

## Configuración y Despliegue

### Variables de Entorno

**Archivo**: `.env` (no versionado)

```env
# Puerto del servidor (desarrollo)
PORT=3000

# Entorno
NODE_ENV=development

# Base de datos PostgreSQL (Neon)
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# APIs Externas
BCRA_API_URL=https://api.bcra.gob.ar/estadisticas/v4.0
FERIADOS_API_URL=https://api.argentinadatos.com/v1/feriados
```

### Configuración de Base de Datos

**Archivo**: `src/config/database.js`

**Pool de Conexiones:**
- Máximo: 20 conexiones
- Timeout inactivo: 30 segundos
- Timeout de conexión: 10 segundos
- SSL: Requerido (para Neon)

### Despliegue en Vercel

**Archivo**: `vercel.json`

**Configuración:**
- Build: `@vercel/node`
- Entry point: `src/app.js`
- Routes: Todas las rutas van a `src/app.js`

**Variables de Entorno en Vercel:**
- `DATABASE_URL`
- `NODE_ENV=production`
- `BCRA_API_URL`
- `FERIADOS_API_URL`

### Scripts NPM

```json
{
  "dev": "nodemon src/app.js",
  "start": "node src/app.js",
  "build": "echo 'Build completado'",
  "vercel-build": "echo 'Vercel build completado'"
}
```

### Zona Horaria

**Configuración**: `America/Argentina/Buenos_Aires`

Se configura en `app.js`:
```javascript
process.env.TZ = 'America/Argentina/Buenos_Aires';
```

---

## Notas Importantes

### Manejo de Fechas

- **Formato de entrada**: DD/MM/AAAA (formularios)
- **Formato interno**: YYYY-MM-DD (BD y APIs)
- **Conversión**: Se realiza automáticamente en controladores

### Manejo de Errores

- APIs externas: Se manejan errores 404/500 gracefully, retornando arrays vacíos
- BD: Se validan formatos antes de insertar
- Frontend: Se muestran mensajes de error al usuario

### Paginación

- Variables (CER, TAMAR, BADLAR): 50 registros por página
- Feriados: 50 registros por página (configurable)
- Se puede filtrar por rango de fechas

### Performance

- Consultas a API BCRA: Se hacen por año para evitar timeouts
- Inserciones en BD: Se hacen en batches de 500 registros
- Pool de conexiones: Reutiliza conexiones para mejor performance

---

## Contacto y Mantenimiento

Este proyecto está en modo de mantenimiento limitado. Para nuevas funcionalidades o correcciones, consultar con el equipo de desarrollo.

**Autor**: Mercap Software
**Versión**: 2.0
**Licencia**: ISC
