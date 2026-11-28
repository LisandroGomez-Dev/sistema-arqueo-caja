import { z } from 'zod';

export const abrirTurnoBodySchema = z.object({
  id_caja: z
    .string({
      required_error: 'Debés seleccionar una caja física para abrir el turno.',
    })
    .trim()
    .min(1, 'Debés seleccionar una caja física para abrir el turno.'),
  fondo_inicial_efectivo: z
    .string({
      required_error: 'El fondo inicial en efectivo es obligatorio (RN-06).',
      invalid_type_error:
        'El fondo inicial debe enviarse como string decimal exacto (ej. "15000.00").',
    })
    .trim()
    .regex(
      /^-?\d+(?:\.\d{1,2})?$/,
      'Formato monetario inválido. Usá hasta 2 decimales (ej. "15000.00").',
    ),
});

export type AbrirTurnoBody = z.infer<typeof abrirTurnoBodySchema>;

export const cerrarTurnoBodySchema = z.object({
  efectivo_declarado: z
    .string({
      required_error:
        'El efectivo físico contado es obligatorio para cerrar el turno (RN-06).',
      invalid_type_error:
        'El efectivo declarado debe enviarse como string decimal exacto (ej. "62500.00").',
    })
    .trim()
    .regex(
      /^-?\d+(?:\.\d{1,2})?$/,
      'Formato monetario inválido. Usá hasta 2 decimales (ej. "62500.00").',
    ),
  observaciones_cierre: z
    .string()
    .max(500, 'Las observaciones de cierre no pueden superar los 500 caracteres.')
    .nullable()
    .optional()
    .transform((v) => v?.trim() || null),
});

export type CerrarTurnoBody = z.infer<typeof cerrarTurnoBodySchema>;
