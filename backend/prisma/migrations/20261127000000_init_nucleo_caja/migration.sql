-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('CAJERO', 'ENCARGADO');

-- CreateEnum
CREATE TYPE "EstadoTurno" AS ENUM ('ABIERTO', 'CERRADO');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('INGRESO', 'EGRESO');

-- CreateEnum
CREATE TYPE "OrigenCarga" AS ENUM ('MANUAL', 'IA_VOZ_TEXTO', 'IA_COMPROBANTE');

-- CreateEnum
CREATE TYPE "EstadoMovimiento" AS ENUM ('ACTIVO', 'ANULADO');

-- CreateEnum
CREATE TYPE "CategoriaIncidencia" AS ENUM ('POSNET', 'QR_PENDIENTE', 'DESCUADRE', 'SISTEMA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoIncidencia" AS ENUM ('PENDIENTE', 'RESUELTA');

-- CreateTable
CREATE TABLE "usuarios" (
    "id_usuario" VARCHAR(36) NOT NULL,
    "nombre_completo" VARCHAR(100) NOT NULL,
    "pin_acceso_hash" VARCHAR(255) NOT NULL,
    "rol_usuario" "RolUsuario" NOT NULL,
    "esta_activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_alta" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "configuracion_caja" (
    "id_configuracion" VARCHAR(36) NOT NULL,
    "nombre_comercio" VARCHAR(100) NOT NULL,
    "multiplo_redondeo_efectivo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "id_usuario_actualizacion" VARCHAR(36) NOT NULL,
    "fecha_ultima_actualizacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuracion_caja_pkey" PRIMARY KEY ("id_configuracion")
);

-- CreateTable
CREATE TABLE "metodos_pago" (
    "id_metodo_pago" VARCHAR(36) NOT NULL,
    "codigo_metodo" VARCHAR(30) NOT NULL,
    "nombre_metodo" VARCHAR(60) NOT NULL,
    "permite_redondeo" BOOLEAN NOT NULL,
    "esta_activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "metodos_pago_pkey" PRIMARY KEY ("id_metodo_pago")
);

-- CreateTable
CREATE TABLE "turnos_caja" (
    "id_turno" VARCHAR(36) NOT NULL,
    "id_usuario_apertura" VARCHAR(36) NOT NULL,
    "fondo_inicial_efectivo" DECIMAL(12,2) NOT NULL,
    "estado_turno" "EstadoTurno" NOT NULL DEFAULT 'ABIERTO',
    "fecha_hora_apertura" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_hora_cierre" TIMESTAMPTZ(6),

    CONSTRAINT "turnos_caja_pkey" PRIMARY KEY ("id_turno")
);

-- CreateTable
CREATE TABLE "movimientos_caja" (
    "id_movimiento" VARCHAR(36) NOT NULL,
    "id_turno" VARCHAR(36) NOT NULL,
    "id_metodo_pago" VARCHAR(36) NOT NULL,
    "id_usuario_registro" VARCHAR(36) NOT NULL,
    "tipo_movimiento" "TipoMovimiento" NOT NULL,
    "monto_operacion" DECIMAL(12,2) NOT NULL,
    "concepto_descripcion" TEXT,
    "origen_carga" "OrigenCarga" NOT NULL,
    "url_comprobante" VARCHAR(255),
    "estado_movimiento" "EstadoMovimiento" NOT NULL DEFAULT 'ACTIVO',
    "motivo_anulacion" TEXT,
    "id_usuario_anulacion" VARCHAR(36),
    "fecha_hora_anulacion" TIMESTAMPTZ(6),
    "fecha_hora_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_caja_pkey" PRIMARY KEY ("id_movimiento")
);

-- CreateTable
CREATE TABLE "arqueos_cierre" (
    "id_arqueo" VARCHAR(36) NOT NULL,
    "id_turno" VARCHAR(36) NOT NULL,
    "id_usuario_cierre" VARCHAR(36) NOT NULL,
    "multiplo_redondeo_aplicado" DECIMAL(12,2) NOT NULL,
    "total_esperado_general" DECIMAL(12,2) NOT NULL,
    "total_declarado_general" DECIMAL(12,2) NOT NULL,
    "ajuste_redondeo_total" DECIMAL(12,2) NOT NULL,
    "diferencia_real_total" DECIMAL(12,2) NOT NULL,
    "observaciones_cierre" TEXT,
    "fecha_hora_cierre" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arqueos_cierre_pkey" PRIMARY KEY ("id_arqueo")
);

-- CreateTable
CREATE TABLE "detalle_arqueo_metodo" (
    "id_detalle_arqueo" VARCHAR(36) NOT NULL,
    "id_arqueo" VARCHAR(36) NOT NULL,
    "id_metodo_pago" VARCHAR(36) NOT NULL,
    "monto_esperado" DECIMAL(12,2) NOT NULL,
    "monto_declarado" DECIMAL(12,2) NOT NULL,
    "ajuste_redondeo" DECIMAL(12,2) NOT NULL,
    "diferencia_real" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "detalle_arqueo_metodo_pkey" PRIMARY KEY ("id_detalle_arqueo")
);

-- CreateTable
CREATE TABLE "incidencias_turno" (
    "id_incidencia" VARCHAR(36) NOT NULL,
    "id_turno" VARCHAR(36) NOT NULL,
    "id_usuario_reporte" VARCHAR(36) NOT NULL,
    "categoria_incidencia" "CategoriaIncidencia" NOT NULL,
    "detalle_incidencia" TEXT NOT NULL,
    "estado_incidencia" "EstadoIncidencia" NOT NULL DEFAULT 'PENDIENTE',
    "id_usuario_resolucion" VARCHAR(36),
    "fecha_hora_resolucion" TIMESTAMPTZ(6),
    "fecha_hora_reporte" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidencias_turno_pkey" PRIMARY KEY ("id_incidencia")
);

-- CreateIndex
CREATE UNIQUE INDEX "metodos_pago_codigo_metodo_key" ON "metodos_pago"("codigo_metodo");

-- CreateIndex
CREATE UNIQUE INDEX "arqueos_cierre_id_turno_key" ON "arqueos_cierre"("id_turno");

-- CreateIndex
CREATE UNIQUE INDEX "detalle_arqueo_metodo_id_arqueo_id_metodo_pago_key" ON "detalle_arqueo_metodo"("id_arqueo", "id_metodo_pago");

-- AddForeignKey
ALTER TABLE "configuracion_caja" ADD CONSTRAINT "configuracion_caja_id_usuario_actualizacion_fkey" FOREIGN KEY ("id_usuario_actualizacion") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_id_usuario_apertura_fkey" FOREIGN KEY ("id_usuario_apertura") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_id_turno_fkey" FOREIGN KEY ("id_turno") REFERENCES "turnos_caja"("id_turno") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_id_metodo_pago_fkey" FOREIGN KEY ("id_metodo_pago") REFERENCES "metodos_pago"("id_metodo_pago") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_id_usuario_registro_fkey" FOREIGN KEY ("id_usuario_registro") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_id_usuario_anulacion_fkey" FOREIGN KEY ("id_usuario_anulacion") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arqueos_cierre" ADD CONSTRAINT "arqueos_cierre_id_turno_fkey" FOREIGN KEY ("id_turno") REFERENCES "turnos_caja"("id_turno") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arqueos_cierre" ADD CONSTRAINT "arqueos_cierre_id_usuario_cierre_fkey" FOREIGN KEY ("id_usuario_cierre") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_arqueo_metodo" ADD CONSTRAINT "detalle_arqueo_metodo_id_arqueo_fkey" FOREIGN KEY ("id_arqueo") REFERENCES "arqueos_cierre"("id_arqueo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_arqueo_metodo" ADD CONSTRAINT "detalle_arqueo_metodo_id_metodo_pago_fkey" FOREIGN KEY ("id_metodo_pago") REFERENCES "metodos_pago"("id_metodo_pago") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidencias_turno" ADD CONSTRAINT "incidencias_turno_id_turno_fkey" FOREIGN KEY ("id_turno") REFERENCES "turnos_caja"("id_turno") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidencias_turno" ADD CONSTRAINT "incidencias_turno_id_usuario_reporte_fkey" FOREIGN KEY ("id_usuario_reporte") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidencias_turno" ADD CONSTRAINT "incidencias_turno_id_usuario_resolucion_fkey" FOREIGN KEY ("id_usuario_resolucion") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- CheckConstraints (RN-06)
ALTER TABLE "configuracion_caja" ADD CONSTRAINT "chk_multiplo_redondeo_no_negativo" CHECK ("multiplo_redondeo_efectivo" >= 0);
ALTER TABLE "turnos_caja" ADD CONSTRAINT "chk_fondo_inicial_no_negativo" CHECK ("fondo_inicial_efectivo" >= 0);
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "chk_monto_operacion_positivo" CHECK ("monto_operacion" > 0);
ALTER TABLE "detalle_arqueo_metodo" ADD CONSTRAINT "chk_monto_declarado_no_negativo" CHECK ("monto_declarado" >= 0);

-- PartialUniqueIndex (RN-05: maximo 1 turno ABIERTO simultaneo)
CREATE UNIQUE INDEX "uniq_unico_turno_abierto"
ON "turnos_caja" ("estado_turno")
WHERE "estado_turno" = 'ABIERTO';

-- PerformanceIndexes (FKs consultadas frecuentemente)
CREATE INDEX "idx_movimientos_caja_id_turno" ON "movimientos_caja" ("id_turno");
CREATE INDEX "idx_movimientos_caja_id_metodo_pago" ON "movimientos_caja" ("id_metodo_pago");
CREATE INDEX "idx_detalle_arqueo_metodo_id_arqueo" ON "detalle_arqueo_metodo" ("id_arqueo");
CREATE INDEX "idx_incidencias_turno_id_turno" ON "incidencias_turno" ("id_turno");

-- RowLevelSecurity (bloquea acceso publico via PostgREST; el backend Prisma opera autenticado)
ALTER TABLE "usuarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "configuracion_caja" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "metodos_pago" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "turnos_caja" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "movimientos_caja" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "arqueos_cierre" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "detalle_arqueo_metodo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incidencias_turno" ENABLE ROW LEVEL SECURITY;



