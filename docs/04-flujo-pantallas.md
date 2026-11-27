# 04. Flujo de Pantallas y Estados Visuales de Mostrador (UX/UI)

> **Proyecto:** Sistema de Arqueo y Cierre de Caja Inteligente  
> **Versión:** 1.1 (MVP)  
> **Issue asociado:** `#13`  
> **Milestone:** `v0.1 - Análisis y Diseño Funcional`  
> **Diseño interactivo en Figma:** [Ver archivo en Figma — Flujo de Pantallas (MVP)](https://www.figma.com/design/4zI3UPcfyBMwTlqohPu7vF)  
> **Documentos de referencia:** [01 - ERS y Reglas de Negocio](./01-alcance-y-reglas.md) · [02 - Modelo de Datos (DER)](./02-modelo-datos.md) · [03 - Arquitectura en 2 Capas](./03-arquitectura-dos-capas.md)

---

## Vista General del Diseño en Figma (Desktop PC de Mostrador — 1280px)

> 📌 **Criterio de plataforma:** Diseñado **Desktop-First para PC de mostrador (`1280×740`)** — el formato estándar en comercios — con soporte de teclado físico (`F1` Ingreso, `F2` Egreso, `Enter` Confirmar, `Ctrl+K` Chat Copiloto IA, `Esc` Cerrar panel) y diseño *responsive* adaptable a tablet/celular (ver segunda pestaña en Figma).

![Flujo de Pantallas Desktop PC y Estados Visuales en Figma](./img/flujo-pantallas-figma.png)

> ℹ️ **Actualización UX v1.1 (`P3` y `M1`):** La vista general superior conserva el panorama completo (`P1`, `P2`, `P4`, `P6` y los 8 estados). Las pantallas actualizadas de **`P3` (Mostrador limpio)** y **`M1` (Chat Copiloto IA deslizable de derecha a izquierda)** se muestran en alta resolución en sus respectivas secciones más abajo, aplicándose en código los rótulos universales **24/7** (`Asistente Operativo 24/7` / `Soporte / Incidencia` en lugar de menciones exclusivas a turno noche).

---

## 1. Principios de Diseño UX para PC de Mostrador (*Desktop-First*)

La interfaz está pensada para el ritmo real de una PC de caja en **cualquier turno (mañana, tarde o noche)**, priorizando:

1. **Regla de los 3 clics + teclado físico:** Registrar un ingreso o egreso manual toma menos de 3 segundos combinando atajos (`F1` Ingreso, `F2` Egreso, `Enter` Registrar) y teclado numérico físico.
2. **Libro diario siempre a la vista:** En `P3` la carga rápida (izquierda) y la tabla inmutable de movimientos (derecha) conviven sin necesidad de hacer scroll ni cambiar de pestaña.
3. **Chat Copiloto IA universal 24/7 en panel lateral (`M1` · `RN-09`):** Se despliega desde la derecha hacia la izquierda (`440px`) como un chat conversacional normal disponible en todos los turnos. Unifica carga por texto/voz (`#8`), lectura de tickets (`#9`) y Asistente Operativo 24/7 (`#10`) en un mismo hilo, presentando tarjetas borrador editables con borde índigo punteado; nunca impacta caja sin confirmación explícita.
4. **Semáforo financiero inmediato:** Los estados de cierre (**Cuadre perfecto**, **Dentro de tolerancia / redondeo**, **Sobrante** y **Faltante**) usan color + ícono + etiqueta textual.
5. **Degradación elegante (`R3`):** Si el Copiloto IA no responde, se muestra un banner no bloqueante *"Copiloto sin conexión — usá la carga rápida manual"* sin interrumpir ventas ni cierres.

---

## 2. Mapa de Navegación (Flujo de Pantallas)

```mermaid
flowchart TD
    P1["P1 · Login Rápido (PIN)"] -->|"JWT válido"| CHECK{"¿Existe turno ABIERTO?\nGET /turnos/activo"}
    CHECK -->|"No"| P2["P2 · Apertura de Caja\n(Fondo inicial efectivo)"]
    CHECK -->|"Sí"| P3["P3 · Terminal de Mostrador\n(Movimientos + Subtotales en vivo)"]
    P2 -->|"POST /turnos/abrir"| P3

    P3 -->|"Botón Abrir Copiloto IA / Ctrl+K"| M1["M1 · Panel Desplegable Chat Copiloto IA\n(Derecha → Izquierda · Voz, Ticket y Asistente 24/7)"]
    M1 -->|"Confirmar borrador (RN-09) / Guardar parte (RN-10)"| P3

    P3 -->|"Botón Cerrar Caja"| P4["P4 · Arqueo y Cierre en 1 Clic"]
    P4 -->|"POST /turnos/:id/cerrar"| P5["P5 · Comprobante de Cierre\n(Turno CERRADO · Copiar resumen)"]
    P5 -->|"Nuevo turno"| P2

    P3 -.->|"Solo rol ENCARGADO (RN-08)"| P6["P6 · Panel Encargado\n(Historial, Incidencias 24/7 y Tolerancia)"]
    P3 -.->|"Anular movimiento (Solo ENCARGADO)"| M3["M3 · Modal Anulación Lógica\n(Motivo obligatorio · RN-01)"]
    M3 -->|"PATCH /anular"| P3
```

---

## 3. Especificación y Wireframes de Pantallas Clave

### P1 · Login Rápido por PIN (`/login`)
- **Actores:** `CAJERO` y `ENCARGADO`.
- **Propósito:** Cambio de operador en mostrador en menos de 3 segundos sin escribir correos largos.
- **Componentes:** Selector de operador activo (tarjetas grandes con nombre y rol) + teclado numérico de PIN (4–6 dígitos) + botón `Ingresar`.

```text
┌────────────────────────────────────┐
│  🧾 ArqueoCaja · Mostrador         │
├────────────────────────────────────┤
│  ¿Quién opera la caja?             │
│  [ 👤 Lucas · Cajero    ] (activo) │
│  [ ⭐ Martín · Encargado ]          │
│                                    │
│  Ingresá tu PIN                    │
│        ●  ●  ●  ○                  │
│   [ 1 ]    [ 2 ]    [ 3 ]          │
│   [ 4 ]    [ 5 ]    [ 6 ]          │
│   [ 7 ]    [ 8 ]    [ 9 ]          │
│   [ ⌫ ]    [ 0 ]    [ ✓ ]          │
└────────────────────────────────────┘
```

---

### P2 · Apertura de Caja (`/apertura`) — *Issue `#2`*
- **Actores:** `CAJERO` / `ENCARGADO`.
- **Reglas visibles:** Valida que no exista otro turno `ABIERTO` (`RN-05`) y `fondo_inicial_efectivo >= 0` (`RN-06`). Aclara explícitamente que el fondo inicial aplica solo a `EFECTIVO` (`RN-02`).

```text
┌────────────────────────────────────┐
│  Abrir Turno de Caja               │
│  Operador: Lucas (Cajero)          │
├────────────────────────────────────┤
│  Fondo inicial en EFECTIVO         │
│  (dinero de cambio en cajón)       │
│  ┌──────────────────────────────┐  │
│  │  $  15.000,00                │  │
│  └──────────────────────────────┘  │
│  Atajos: [$0] [$10.000] [$20.000]  │
│                                    │
│  ℹ QR/Transferencia y Tarjeta      │
│    inician automáticamente en $0   │
│                                    │
│  [     ▶ ABRIR TURNO DE CAJA    ]  │
└────────────────────────────────────┘
```

---

### P3 · Terminal de Mostrador (`/mostrador`) — *Issues `#3`, `#4`, `#8`, `#9`, `#10`*
- **Actores:** `CAJERO` (operación completa en cualquier turno) y `ENCARGADO` (habilita acción `Anular` en cada fila y acceso a `Panel Encargado`).
- **Propósito:** Pantalla principal durante toda la jornada. Combina subtotales en vivo por canal, carga rápida manual en 3 clics (izquierda), libro diario inmutable (derecha) y acceso directo al **Chat Copiloto IA 24/7** (`Ctrl+K`) que se despliega desde la derecha.

![P3 Terminal de Mostrador actualizado en Figma](./img/mostrador-p3-figma.png)

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Terminal de Mostrador — Turno #14   [✨ Abrir Copiloto IA ←] [🔒 Cerrar]│
├──────────────────────────────────────────────────────────────────────┤
│  EFECTIVO EN CAJÓN       QR / TRANSFERENCIA       TARJETA            │
│  $ 62.500,00             $ 48.200,00              $ 31.000,00        │
│  (inc. $15k fondo)       (concil. exacta)         (concil. exacta)   │
├─────────────────────────────────┬────────────────────────────────────┤
│  CARGA RÁPIDA MANUAL (3 CLICS)  │  LIBRO DIARIO DEL TURNO (RN-01)    │
│  [ + INGRESO (F1) ] [ - EGRESO ]│  19:14  Venta mostrador  +$12.500  │
│  [Efectivo][QR/Transf][Tarjeta] │  19:02  Pago soda [IA]    -$8.500  │
│  Monto:    [ $ 12.500,00  ARS ] │  18:54  Compra mesa 4    +$24.200  │
│  Concepto: [ ________________ ] │  18:45  ~~Error~~ [ANULADO]        │
│  [  Registrar Movimiento (↵)  ] │  18:20  Venta fiambre    +$31.000  │
│                                 │                                    │
│  ✨ ¿Dictar, leer ticket o      │                                    │
│     soporte 24/7? Ctrl+K →      │                                    │
└─────────────────────────────────┴────────────────────────────────────┘
```

---

### M1 · Panel Desplegable Chat Copiloto IA (Derecha → Izquierda · 24/7) — *Issues `#8`, `#9` y `#10`*
- **Disparador:** Botón **`Abrir Copiloto IA ←`** en la barra superior de `P3` o atajo **`Ctrl+K`**. Disponible para **todos los turnos (mañana, tarde y noche)**.
- **Comportamiento clave:** Se desliza de derecha a izquierda (`440px`) sobre el mostrador ligeramente atenuado sin tapar por completo el contexto de caja. Funciona como un chat conversacional natural donde el cajero escribe, dicta por micrófono (`🎤`) o adjunta foto de ticket (`📷`):
  - **Cargas por voz/texto o comprobante (`#8`, `#9`):** La IA responde dentro del hilo con una **tarjeta borrador editable (`RN-09`)**, badge de confianza (`94%`) y botones **`Descartar`** / **`Confirmar`**. Nada impacta el libro diario sin confirmación humana.
  - **Asistente Operativo de Turno 24/7 (`#10`):** Ante dudas operativas o fallas (ej. corte de POSNET, transferencia demorada o pre-auditoría de descuadre), guía paso a paso y ofrece una tarjeta inline de **`Parte de Incidencia`** lista para **`Guardar`** (`RN-10`).

![M1 Panel Desplegable Chat Copiloto IA en Figma](./img/chat-copiloto-m1-figma.png)

> 📌 **Nota de textos universales para implementación:** Al llevar `M1` y `P3` a código React, usar exclusivamente terminología universal 24/7: chip **`Soporte / Incidencia`** (en vez de *"Guardia noche"*), cabecera **`Copiloto IA · Operativo 24/7`** y tarjeta de ayuda en `P3` con *"consultar soporte de turno"*.

```text
╔══════════════════════════════════════════════╗
║  ✨ Copiloto IA · Operativo 24/7         [✕] ║
║  gemini-4-hydrogen · Solo sugiere (RN-09)    ║
║  [🎤 Voz]  [📷 Leer ticket]  [🛡 Soporte]    ║
╠══════════════════════════════════════════════╣
║                  ┌─────────────────────────┐ ║
║                  │ Salió 8500 en efectivo  │ ║
║                  │ para el sodero          │ ║
║                  └─────────────────────────┘ ║
║ ┌──────────────────────────────────────────┐ ║
║ │ Armé este borrador editable (RN-09): 94% │ ║
║ │ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │ ║
║ │   EGRESO · EFECTIVO        $ 8.500,00    │ ║
║ │ │ Concepto: Pago a proveedor de soda   │ │ ║
║ │   [ Descartar ]      [ ✓ Confirmar ]     │ ║
║ │ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │ ║
║ └──────────────────────────────────────────┘ ║
║               ┌────────────────────────────┐ ║
║               │ Se cortó el posnet con un  │ ║
║               │ pago de $12.500, ¿qué hago?│ ║
║               └────────────────────────────┘ ║
║ ┌──────────────────────────────────────────┐ ║
║ │ 1) Pedí captura del comprobante.         │ ║
║ │ 2) Dejo listo el parte de incidencia:    │ ║
║ │ ┌──────────────────────────────────────┐ │ ║
║ │ │ Parte: POSNET · Turno #14  [Guardar] │ │ ║
║ │ └──────────────────────────────────────┘ │ ║
║ └──────────────────────────────────────────┘ ║
╠══════════════════════════════════════════════╣
║ [ Escribí al Copiloto IA...   ] [📷][🎤][➤] ║
╚══════════════════════════════════════════════╝
```

---

### P4 · Arqueo y Cierre de Caja en 1 Clic (`/cierre`) — *Issues `#5` y `#6`*
- **Propósito:** Conciliación sin fricción. Los canales digitales se muestran pre-conciliados (`ajuste = $0,00`, `diferencia = $0,00` por `RN-03`). El operador solo cuenta el efectivo físico o confirma en 1 clic si coincide exactamente.
- **Feedback en vivo:** Al tipear el efectivo contado, la tarjeta de resultado recalcula al instante `ajuste_redondeo` y `diferencia_real` aplicando el `multiplo_redondeo_efectivo` vigente (`RN-04`, `RN-07`).

```text
┌──────────────────────────────────────────────┐
│  🔒 Arqueo y Cierre de Turno                 │
│  Regla redondeo vigente: Múltiplo de $100    │
├──────────────────────────────────────────────┤
│  CANALES DIGITALES (Conciliación exacta)     │
│  📱 QR / Transferencia   $ 48.200,00   ✓ OK  │
│  💳 Tarjeta              $ 31.000,00   ✓ OK  │
├──────────────────────────────────────────────┤
│  EFECTIVO EN CAJÓN                           │
│  Esperado (con $15.000 fondo):  $ 62.530,00  │
│                                              │
│  Efectivo físico contado:                    │
│  [ $ 62.500,00 ]   [ ✓ Coincide exacto ]     │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 🔵 AJUSTE POR REDONDEO COMERCIAL       │  │
│  │ Redondeo absorbido: -$30,00 (regla $100)│ │
│  │ Diferencia real de caja: $0,00 (Exacto)│  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Observaciones (opcional): [ _____________ ] │
│  [ ⚠ CONFIRMAR CIERRE DEFINITIVO DEL TURNO ] │
└──────────────────────────────────────────────┘
```

---

### P5 · Comprobante de Cierre (`/cierre/:idArqueo`) — *Issues `#6` y `#7`*
- **Propósito:** Confirmar que el turno pasó a `CERRADO` (`RN-05`) y ofrecer el botón **`📋 Copiar resumen para WhatsApp`** con el desglose completo (fecha, operador, totales por método, redondeo aplicado, diferencia real e incidencias del turno).

---

### P6 · Panel de Encargado (`/admin`) — *Issues `#5`, `#7` y `#10`*
- **Acceso:** Exclusivo rol `ENCARGADO` (`RN-08`; devuelve HTTP `403` a `CAJERO`).
- **3 pestañas simples:**
  1. **Historial de Cierres y Acumulado por Cajero:** Filtros por rango de fechas y operador, semáforo de diferencia por turno, **acumulado mensual de tolerancia/redondeo por cajero** *(control anti robo hormiga, `RN-04`)* y botón de copiar resumen.
  2. **Incidencias de Turno (Asistente Operativo 24/7):** Listado de contingencias de todos los turnos con filtro `PENDIENTE` / `RESUELTA` y acción `✓ Marcar como resuelta` (registra `id_usuario_resolucion` y `fecha_hora_resolucion`, `RN-10`).
  3. **Configuración de Tolerancia / Redondeo (`RF-09`):** Selector de margen (`$0 Estricto por defecto`, `$10`, `$100`, `$500` o valor personalizado `>= 0`) con aviso explícito: *"Este cambio aplica solo a cierres futuros; los cierres históricos conservan su regla original (`RN-04`)"*.

---

## 4. Catálogo de Estados Visuales de Alerta en Mostrador

| Estado Visual | Condición Determinística | Paleta / Semáforo | Ícono | Mensaje de Mostrador |
| :--- | :--- | :--- | :---: | :--- |
| **Cuadre Perfecto** | `diferencia_real = 0` y `ajuste_redondeo = 0` | Verde (`emerald-600` / fondo `emerald-50`) | ✅ | **Caja cuadrada exacta ($0,00).** Lista para cerrar en 1 clic. |
| **Dentro de Tolerancia / Redondeo (`RN-04`)** | `diferencia_real = 0` y `0 < \|ajuste_redondeo\| < margen` | Azul / Celeste (`sky-600` / fondo `sky-50`) | 🔵 | **Absorbido por margen de tolerancia del local.** No se imputa faltante al cajero; queda registrado para control mensual. |
| **Sobrante Real (`RN-07`)** | `diferencia_real > 0` | Ámbar (`amber-600` / fondo `amber-50`) | ⚠️ | **Sobrante de `+$X` (queda para la empresa).** Si supera el margen, alerta posible cobro de más a cliente para respaldo ante reclamo/devolución. |
| **Faltante Real Imputable (`RN-07`)** | `diferencia_real < 0` *(o faltante `>= margen`)* | Rojo (`rose-600` / fondo `rose-50`) | 🚨 | **Faltante real de `-$X` (imputable al cierre).** Sugerencia: revisar egresos sin cargar o usar *Pre-auditoría IA* antes de confirmar. |
| **Movimiento Anulado** | `estado_movimiento = 'ANULADO'` | Gris neutro (`slate-500`) + texto tachado | 🚫 | **ANULADO** *(no suma al saldo)* — muestra motivo, encargado y hora (`RN-01`). |
| **Borrador IA (`RN-09`)** | Respuesta de `AdaptadorGeminiIA` pendiente | Violeta / Índigo (`indigo-600` / borde punteado) | ✨ | **Sugerencia IA pendiente de confirmación.** Si `confianza < 0.80`, resalta campos a revisar. |
| **Turno Cerrado (`RN-05`)** | `estado_turno = 'CERRADO'` | Gris oscuro (`zinc-700`) + controles deshabilitados | 🔒 | **Turno cerrado y bloqueado.** Solo lectura para auditoría. |
| **Copiloto IA Offline (`R3`)** | Timeout `> 8s` o error `503` de Gemini | Ámbar suave (banner no bloqueante) | 📡 | **Copiloto IA temporalmente no disponible.** Podés seguir cargando manualmente sin interrupciones. |
