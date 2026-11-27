# 🧾 Sistema de Arqueo y Cierre de Caja Inteligente

Sistema web orientado a automatizar el registro de ingresos/egresos por método de pago y simplificar el **arqueo y cierre de caja en 1 clic**, incorporando un **Copiloto IA (`gemini-4-hydrogen`)** para carga rápida manos libres, lectura de comprobantes y asistencia operativa en turno noche.

> 📋 **Seguimiento del proyecto:** Podés ver el avance en tiempo real en el tablero Kanban: [**Roadmap - Sistema Arqueo de Caja**](https://github.com/LisandroGomez-Dev/sistema-arqueo-caja/projects)

---

## 🎯 Problema que resuelve

En la mayoría de los comercios chicos y medianos, el cierre de caja sigue siendo manual: contar billetes, revisar cupones de posnet y conciliar transferencias en planillas o cuadernos. Esto genera pérdida de tiempo al final de la jornada, errores humanos y falta de trazabilidad ante descuadres (especialmente en turnos nocturnos sin soporte administrativo).

### Solución: Arquitectura en 2 Capas
1. **Núcleo de Caja Determinístico:** Lógica contable pura y exacta (sin intervención de IA en los cálculos) que garantiza inmutabilidad de movimientos, separación por método de pago y cálculo de redondeo comercial.
2. **Copiloto IA (Gemini 4 Hydrogen):** Capa de asistencia inteligente para:
   - Carga rápida en lenguaje natural / voz (*Structured Outputs*).
   - Extracción automática de datos desde fotos de tickets/comprobantes.
   - **Asistente de Guardia Nocturna:** Guía de contingencias y pre-auditoría de descuadres cuando Administración no está disponible.

---

## 📚 Documentación Funcional y Técnica (`/docs`)

| Documento | Descripción | Estado |
| :--- | :--- | :---: |
| [01 - Alcance, Actores y Reglas de Negocio](./docs/01-alcance-y-reglas.md) | ERS del MVP: propósito, alcance, perfiles, RN, RF, RNF, riesgos y Casos de Uso. | ✅ Completado (#1) |
| [02 - Modelo de Datos (DER)](./docs/02-modelo-datos.md) | Diseño entidad-relación (3FN) y diccionario de datos. | ✅ Completado (#11) |
| [03 - Arquitectura en 2 Capas](./docs/03-arquitectura-dos-capas.md) | Arquitectura Hexagonal, Patrones GoF, Diagrama de Clases, 4 Secuencias UML y contrato Gemini API. | ✅ Completado (#12) |
| [04 - Flujo de Pantallas (UX/UI)](./docs/04-flujo-pantallas.md) | Diseño Desktop PC en Figma (1280px), mapa de navegación, wireframes y estados visuales. | ✅ Completado (#13) |

---

## 🛠️ Metodología de Trabajo
El proyecto se gestiona mediante **GitHub Issues + GitHub Projects (Kanban)** organizado en 4 Milestones iterativos (`v0.1` a `v0.4`), vinculando cada entrega documental y de código a su respectivo Issue.
