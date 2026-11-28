import { z } from 'zod';

const optionalTrimmed = z
  .string()
  .optional()
  .transform((v) => {
    const trimmed = v?.trim();
    return trimmed ? trimmed : undefined;
  });

export const listarArqueosQuerySchema = z.object({
  fecha_desde: optionalTrimmed.refine(
    (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v),
    'La fecha "desde" debe tener formato YYYY-MM-DD.',
  ),
  fecha_hasta: optionalTrimmed.refine(
    (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v),
    'La fecha "hasta" debe tener formato YYYY-MM-DD.',
  ),
  id_usuario: optionalTrimmed,
  id_caja: optionalTrimmed,
  estado_resultado: z
    .enum([
      'CUADRE_PERFECTO',
      'DENTRO_TOLERANCIA',
      'SOBRANTE',
      'FALTANTE',
    ])
    .optional(),
  mes: optionalTrimmed.refine(
    (v) => !v || /^\d{4}-(0[1-9]|1[0-2])$/.test(v),
    'El parámetro mes debe tener formato YYYY-MM.',
  ),
});

export type ListarArqueosQuery = z.infer<typeof listarArqueosQuerySchema>;
