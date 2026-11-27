import { z } from 'zod';

export const loginBodySchema = z.object({
  id_usuario: z
    .string({ required_error: 'Debés seleccionar un operador.' })
    .min(1, 'Debés seleccionar un operador.'),
  pin: z
    .string({ required_error: 'Debés ingresar tu PIN de acceso.' })
    .regex(/^\d{4,6}$/, 'El PIN debe contener entre 4 y 6 dígitos numéricos.'),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
