import { z } from 'zod';

export const actualizarConfiguracionCajaBodySchema = z.object({
  multiplo_redondeo_efectivo: z
    .string({
      required_error:
        'El margen de tolerancia/redondeo en efectivo es obligatorio (RF-09).',
      invalid_type_error:
        'El margen de redondeo debe enviarse como string decimal exacto (ej. "100.00").',
    })
    .trim()
    .regex(
      /^-?\d+(?:\.\d{1,2})?$/,
      'Formato monetario inválido. Usá hasta 2 decimales (ej. "0.00", "100.00").',
    ),
});

export type ActualizarConfiguracionCajaBody = z.infer<
  typeof actualizarConfiguracionCajaBodySchema
>;
