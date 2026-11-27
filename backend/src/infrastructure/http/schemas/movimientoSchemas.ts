import { z } from 'zod';

const tipoMovimientoSchema = z.enum(['INGRESO', 'EGRESO'], {
  errorMap: () => ({
    message: 'El tipo de movimiento debe ser INGRESO o EGRESO.',
  }),
});

const codigoMetodoPagoSchema = z.enum(
  ['EFECTIVO', 'QR_TRANSFERENCIA', 'TARJETA'],
  {
    errorMap: () => ({
      message:
        'El método de pago debe ser EFECTIVO, QR_TRANSFERENCIA o TARJETA (RN-02).',
    }),
  },
);

const montoOperacionSchema = z
  .string({
    required_error: 'El importe de la operación es obligatorio (RN-06).',
    invalid_type_error:
      'El importe debe enviarse como string decimal exacto (ej. "12500.00").',
  })
  .trim()
  .regex(
    /^-?\d+(?:\.\d{1,2})?$/,
    'Formato monetario inválido. Usá hasta 2 decimales (ej. "12500.00").',
  );

export const registrarMovimientoBodySchema = z.object({
  tipo_movimiento: tipoMovimientoSchema,
  codigo_metodo_pago: codigoMetodoPagoSchema,
  monto_operacion: montoOperacionSchema,
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

export const reemplazoMovimientoSchema = z.object({
  tipo_movimiento: tipoMovimientoSchema.optional(),
  codigo_metodo_pago: codigoMetodoPagoSchema.optional(),
  monto_operacion: montoOperacionSchema,
  concepto_descripcion: z
    .string()
    .max(300, 'El concepto no puede superar los 300 caracteres.')
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v?.trim() || null)),
});

export const anularMovimientoBodySchema = z.object({
  motivo_anulacion: z
    .string({
      required_error: 'El motivo de anulación es obligatorio (RN-01).',
    })
    .trim()
    .min(
      3,
      'El motivo de anulación debe tener al menos 3 caracteres (RN-01).',
    )
    .max(300, 'El motivo de anulación no puede superar los 300 caracteres.'),
  reemplazo: reemplazoMovimientoSchema.nullable().optional(),
});

export type AnularMovimientoBody = z.infer<typeof anularMovimientoBodySchema>;
