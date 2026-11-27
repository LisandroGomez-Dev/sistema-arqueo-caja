-- Evolución Multi-Caja (modelo supermercado / FACOR · RN-05)

-- 1. Crear tabla cajas
CREATE TABLE "cajas" (
    "id_caja" VARCHAR(36) NOT NULL,
    "numero_caja" INTEGER NOT NULL,
    "nombre_caja" VARCHAR(60) NOT NULL,
    "esta_activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cajas_pkey" PRIMARY KEY ("id_caja")
);

CREATE UNIQUE INDEX "cajas_numero_caja_key" ON "cajas"("numero_caja");
ALTER TABLE "cajas" ADD CONSTRAINT "chk_numero_caja_positivo" CHECK ("numero_caja" > 0);
ALTER TABLE "cajas" ENABLE ROW LEVEL SECURITY;

-- 2. Garantizar al menos Caja 1 por defecto para migrar turnos existentes sin pérdida
INSERT INTO "cajas" ("id_caja", "numero_caja", "nombre_caja", "esta_activa")
VALUES
    ('55555555-5555-4555-8555-555555555501', 1, 'Caja 1 — Línea Principal', true),
    ('55555555-5555-4555-8555-555555555502', 2, 'Caja 2 — Línea Principal', true),
    ('55555555-5555-4555-8555-555555555503', 3, 'Caja 3 — Caja Rápida', true),
    ('55555555-5555-4555-8555-555555555504', 4, 'Caja 4 — Mayorista', true)
ON CONFLICT ("numero_caja") DO NOTHING;

-- 3. Agregar columna id_caja a turnos_caja y backfill con Caja 1 si hubiera turnos previos
ALTER TABLE "turnos_caja" ADD COLUMN "id_caja" VARCHAR(36);
UPDATE "turnos_caja"
SET "id_caja" = '55555555-5555-4555-8555-555555555501'
WHERE "id_caja" IS NULL;
ALTER TABLE "turnos_caja" ALTER COLUMN "id_caja" SET NOT NULL;

ALTER TABLE "turnos_caja"
ADD CONSTRAINT "turnos_caja_id_caja_fkey"
FOREIGN KEY ("id_caja") REFERENCES "cajas"("id_caja")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "idx_turnos_caja_id_caja" ON "turnos_caja" ("id_caja");

-- 4. Reemplazar unicidad mono-caja por doble unicidad multi-caja (RN-05)
DROP INDEX IF EXISTS "uniq_unico_turno_abierto";

-- Máximo 1 turno ABIERTO por cada caja física
CREATE UNIQUE INDEX "uniq_turno_abierto_por_caja"
ON "turnos_caja" ("id_caja")
WHERE "estado_turno" = 'ABIERTO';

-- Máximo 1 turno ABIERTO simultáneo por operador
CREATE UNIQUE INDEX "uniq_turno_abierto_por_usuario"
ON "turnos_caja" ("id_usuario_apertura")
WHERE "estado_turno" = 'ABIERTO';
