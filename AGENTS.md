# AGENTS.md — Contrato Técnico y Reglas para Agentes / Orquestadores

Este archivo es la guía operativa obligatoria para cualquier agente u orquestador (Neon, equipos multi-agente o asistentes individuales) que trabaje en **`sistema-arqueo-caja`**.

---

## 1. Fuente de Verdad Obligatoria (Leer Antes de Programar)

Toda la fase `v0.1` está cerrada y aprobada. **Ningún agente puede inventar requisitos, cambiar el stack ni alterar el modelo de datos** sin aprobación explícita del usuario:

1. **ERS y Reglas de Negocio (`RN-01` a `RN-10`):** `docs/01-alcance-y-reglas.md`
2. **Modelo de Datos 3FN (8 entidades en español):** `docs/02-modelo-datos.md`
3. **Arquitectura Hexagonal, GoF, API REST y Contratos Gemini:** `docs/03-arquitectura-dos-capas.md`
4. **Flujo de Pantallas Desktop-First (`1280px`) y Chat Lateral (`M1`):** `docs/04-flujo-pantallas.md`
5. **Diseño interactivo en Figma:** `https://www.figma.com/design/4zI3UPcfyBMwTlqohPu7vF`

---

## 2. Stack Tecnológico Oficial (Inamovible)

- **Backend (`backend/`):** Node.js + TypeScript + Fastify + `decimal.js` + Zod + Prisma ORM + PostgreSQL (Supabase) + `@google/genai` (`gemini-4-hydrogen`) + Vitest.
- **Frontend (`frontend/`):** React + Vite + TypeScript + Tailwind CSS + Lucide React.
- **Idioma:** Toda la interfaz, mensajes de error, documentación y commits van en **español rioplatense**.

---

## 3. Reglas No Negociables de Arquitectura y Dominio

### 3.1 Arquitectura Hexagonal + 4 Patrones GoF
Respetar estrictamente la separación de carpetas en `backend/src/`:
- `domain/`: **cero dependencias externas** (prohibido importar Fastify, Prisma o `@google/genai`). Contiene entidades, `Dinero` (`decimal.js`), errores de dominio y los patrones:
  - **State:** `EstadoTurno` → `EstadoTurnoAbierto` / `EstadoTurnoCerrado` (`RN-05`).
  - **Strategy:** `EstrategiaRedondeo` → `RedondeoComercialStrategy` / `SinRedondeoStrategy` (`RN-03`, `RN-04`).
- `application/`: **Facade** (`CajaFacade`), casos de uso, DTOs (`BorradorMovimiento`, `DiagnosticoGuardia`) y puertos `ports/out/` (incluyendo `CopilotoIA`).
- `infrastructure/`: adaptadores `http/` (Fastify + Zod + JWT + RoleGuard), `persistence/` (Prisma) y `ai/` (**Adapter:** `AdaptadorGeminiIA`).

### 3.2 Modelo de Datos Exacto (9 Tablas en Español — 3FN · Multi-Caja)
Usar exactamente los nombres de tablas y columnas definidos en `docs/02-modelo-datos.md` (**no traducir al inglés ni agregar tablas fuera del DER**):
1. `usuarios`
2. `configuracion_caja`
3. `metodos_pago`
4. `cajas` *(terminales físicas de cobro del local: `Caja 1`, `Caja 2`, ..., `Caja N`)*
5. `turnos_caja` *(con FK `id_caja` + doble índice único parcial PostgreSQL para `RN-05`: `uniq_turno_abierto_por_caja` y `uniq_turno_abierto_por_usuario`)*
6. `movimientos_caja`
7. `arqueos_cierre`
8. `detalle_arqueo_metodo`
9. `incidencias_turno`

### 3.3 Precisión Monetaria (`RNF-01`, `RN-06`)
- **Prohibido usar `number` / `float` / `DOUBLE`** para cálculos monetarios.
- Usar `decimal.js` en dominio/servicios, `DECIMAL(12,2)` en PostgreSQL/Prisma y strings decimales en contratos JSON (ej. `"8500.00"`).
- Todo movimiento requiere `monto_operacion > 0` (`INGRESO` o `EGRESO`). Todo `EGRESO` exige `concepto_descripcion` no vacío. `fondo_inicial_efectivo >= 0` y `monto_declarado >= 0`.

### 3.4 Inmutabilidad Contable y Roles (`RN-01`, `RN-08`)
- **Prohibido `DELETE`** o modificar importes/métodos en `movimientos_caja`.
- Correcciones solo mediante **anulación lógica simple** (`estado_movimiento = 'ANULADO'`, con `motivo_anulacion`, `id_usuario_anulacion` y `fecha_hora_anulacion`), sin contra-asientos ni FKs recursivas.
- Segregación de roles estricta:
  - `CAJERO`: abrir turno, registrar movimientos, usar Copiloto IA 24/7, cerrar su turno.
  - `ENCARGADO`: todo lo anterior + anular movimientos, configurar tolerancia/redondeo, consultar historial/acumulados y resolver incidencias (`HTTP 403` si un `CAJERO` intenta acceder).

### 3.5 Motor de Cierre, Tolerancia y Sobrantes (`RN-03`, `RN-04`, `RN-07`)
- **Canales digitales (`QR_TRANSFERENCIA`, `TARJETA`):** conciliación exacta (`ajuste_redondeo = 0.00`).
- **Efectivo:**
  - Por defecto opera en **modo estricto (`$0`)**. El Encargado puede configurar un margen de tolerancia/redondeo (`$0`, `$10`, `$100`, `$500` o valor `>= 0`).
  - Faltante estrictamente `< margen` → absorbido en `ajuste_redondeo` (`diferencia_real = 0`), con seguimiento de **acumulado mensual por cajero** en el Panel Encargado (*anti robo hormiga*).
  - Faltante `>= margen` → imputado como `diferencia_real < 0`.
  - Sobrante (`diferencia_real > 0`) → siempre a favor de la empresa; si supera el margen, mostrar alerta de **posible reclamo de cliente**.
  - Cumplir siempre: `Diferencia Bruta = Ajuste por Redondeo + Diferencia Real`.
  - Congelar `multiplo_redondeo_aplicado` en `arqueos_cierre` como foto histórica inmutable.

### 3.6 Copiloto IA Universal 24/7 y Chat Lateral (`RN-09`, `RN-10`, `R3`)
- Disponible para **todos los turnos (mañana, tarde y noche)** — nunca restringido ni etiquetado como exclusivo de turno noche.
- **Referencia visual exacta:** seguir [mostrador-p3-figma.png](./docs/img/mostrador-p3-figma.png) y [chat-copiloto-m1-figma.png](./docs/img/chat-copiloto-m1-figma.png) con las siguientes especificaciones de diseño:
  - **Activación desde `P3`:** botón índigo (`#4F46E5`) **`Abrir Copiloto IA ←`** en la barra superior derecha (junto a `Cerrar Caja en 1 Clic`) + atajo **`Ctrl+K`** + tarjeta de ayuda discreta debajo del formulario manual.
  - **Drawer `M1` (Derecha → Izquierda, `440px` en desktop / `100%` en móvil):** desliza suavemente desde el borde derecho sobre el mostrador con backdrop semitransparente oscuro y sombra lateral izquierda.
  - **Header oscuro (`#0F172A`):** ícono índigo + título **`Copiloto IA · Operativo 24/7`** + subtítulo `gemini-4-hydrogen · Solo sugiere (RN-09)` + botón cerrar (`X` / `Esc`) + 3 chips rápidos: `Cargar por voz`, `Leer ticket`, `Soporte / Incidencia` *(reemplazar cualquier mención vieja a "Guardia noche" por estos rótulos universales)*.
  - **Hilo de conversación unificado:** burbujas del usuario alineadas a la derecha en `#0F172A` con texto blanco; respuestas del asistente a la izquierda en tarjetas blancas (`#FFFFFF` con borde `#E2E8F0`) que pueden incluir:
    1. **Tarjeta borrador editable inline (`RN-09`):** borde punteado índigo (`#6366F1`), badge de confianza (`94% conf.`), campos editables (tipo, método, monto en tipografía mono `JetBrains Mono`, concepto) y botones `Descartar` / `Confirmar`.
    2. **Tarjeta de Parte de Incidencia inline (`RN-10`):** borde ámbar (`#D97706`), categoría + resumen editable y botón `Guardar`.
  - **Barra inferior fija de entrada:** input de texto (`Escribí al Copiloto IA...`) + botón adjuntar imagen/ticket (`📷`) + micrófono (`🎤`) + enviar (`➤` índigo).
- **Endpoints que consume el chat:**
  1. Carga por texto/voz (`POST /api/v1/ia/interpretar-movimiento`).
  2. Lectura de comprobantes/tickets (`POST /api/v1/ia/leer-comprobante`).
  3. Asistente Operativo de Turno 24/7 (`POST /api/v1/ia/asistente-operativo`).
- La IA **solo sugiere** (`Structured Outputs` + validación Zod). Timeout máximo de `8s` con degradación elegante a carga manual (`HTTP 503` no bloqueante).

### 3.7 UX Desktop-First (`1280px`) y Sistema Visual
- **Paleta base:** sidebar oscuro `#0F172A`, fondo contenido `#F8FAFC`, tarjetas `#FFFFFF` con borde `#E2E8F0`, primario índigo `#4F46E5`, éxito/ingreso `#059669`, alerta/sobrante `#D97706`, error/egreso/faltante `#E11D48`.
- **Tipografía:** `Plus Jakarta Sans` para UI y **`JetBrains Mono`** (`tabular-nums`) para todos los montos monetarios y horarios.
- Priorizar operación en PC de mostrador con atajos de teclado (`F1` Ingreso, `F2` Egreso, `Enter` Registrar, `Ctrl+K` Chat Copiloto IA, `Esc` Cerrar panel), manteniendo diseño *responsive* para tablet/celular.

---

## 4. Hoja de Ruta y Alcance por Issue (Trabajar 1 Issue a la Vez)

**Prohibido implementar todo el MVP de golpe.** Completar, testear y validar un Issue antes de pasar al siguiente:

| Milestone | Issue | Alcance | Estado |
| :--- | :---: | :--- | :---: |
| `v0.1` | `#1`, `#11`, `#12`, `#13` | Documentación funcional, DER, arquitectura y diseño UX/UI | ✅ Cerrado |
| `v0.2` | **`#2`** | Scaffolding `backend/` + `frontend/`, Auth PIN/JWT y **Apertura de Turno** (`RN-02`, `RN-05`, `RN-06`) | 🟢 Próximo |
| `v0.2` | **`#3`** | Registro rápido de **Ingresos/Egresos** y Libro Diario en vivo (`RN-02`, `RN-06`) | ⏳ Pendiente |
| `v0.2` | **`#4`** | **Anulación lógica** con motivo obligatorio y rol `ENCARGADO` (`RN-01`, `RN-08`) | ⏳ Pendiente |
| `v0.3` | **`#5`** | **Motor determinístico de redondeo/tolerancia** + configuración (`RF-09`) + suite Vitest | ⏳ Pendiente |
| `v0.3` | **`#6`** | **Pantalla Arqueo y Cierre en 1 Clic** + transacción atómica + comprobante WhatsApp | ⏳ Pendiente |
| `v0.3` | **`#7`** | **Panel Encargado**: historial de cierres, filtros y acumulado mensual por cajero | ⏳ Pendiente |
| `v0.4` | **`#8`** | **Chat Copiloto IA (Drawer Derecha → Izquierda)**: carga por texto/voz (`RN-09`) | ⏳ Pendiente |
| `v0.4` | **`#9`** | **Lectura de tickets/comprobantes** por imagen dentro del chat IA | ⏳ Pendiente |
| `v0.4` | **`#10`** | **Asistente Operativo 24/7** + partes de incidencia (`RN-10`) + resolución en Panel Encargado | ⏳ Pendiente |

---

## 5. Protocolo de Calidad, Seguridad y Git

1. **Secretos:** nunca hardcodear API keys, JWT secrets ni strings de conexión. Mantener `.env` en `.gitignore` y proveer `.env.example` actualizado.
2. **Validación obligatoria por entrega:** antes de dar por terminado un Issue, ejecutar verificación de tipos (`tsc --noEmit`), build y tests (`vitest` / tests de integración) asegurando 0 errores.
3. **Commits:** en español, estilo convencional (`feat(backend): ...`, `feat(frontend): ...`, `test(domain): ...`, `fix(...): ...`). **Presentar los commits propuestos al usuario antes de ejecutarlos.**
4. **Prohibido `git push` automático:** el usuario revisa localmente y ejecuta `git push origin main`.
5. **Integridad de Issues:** nunca agregar `Closes #N` sin verificar que el Issue `#N` esté 100% completo y validado contra la tabla de la sección 4.
