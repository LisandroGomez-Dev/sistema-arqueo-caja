import { z } from 'zod';

export const registrarMovimientoBodySchema = z.object({
  tipo_movimiento: z.enum(['INGRESO', 'EGRESO'], {
    errorMap: () => ({
      message: 'El tipo de movimiento debe ser INGRESO o EGRESO.',
    }),
  }),
  codigo_metodo_pago: z.enum(['EFECTIVO', 'QR_TRANSFERENCIA', 'TARJETA'], {
    errorMap: () => ({
      message:
        'El método de pago debe ser EFECTIVO, QR_TRANSFERENCIA o TARJETA (RN-02).',
    }),
  }),
  monto_operacion: z
    .string({
      required_error: 'El importe de la operación es obligatorio (RN-06).',
      invalid_type_error:
        'El importe debe enviarse como string decimal exacto (ej. "12500.00").',
    })
    .trim()
    .regex(
      /^-?\d+(?:\.\d{1,2})?$/,
      'Formato monetario inválido. Usá hasta 2 decimales (ej. "12500.00").',
    ),
  concepto_descripcion: z
    .string()
    .max(300, 'El concepto no puede superar los 300 caracteres.')
    .nullable()
    .optional()
    .transform((v) => v?.trim() || null),
  origen_carga: z
    .enum(['MANUAL', 'IA_VOZ_TEXTO', 'IA_COMPROBANTE'])
    .optional()
    .default('MANUAL'),
  url_comprobante: z.string().max(255).nullable().optional(),
});

export type RegistrarMovimientoBody = z.infer<
  typeof registrarMovimientoBodySchema
>;
