import type { FastifyInstance } from 'fastify';
import type { CajaFacade } from '../../../application/facade/CajaFacade.js';
import { autenticarJWT, requerirRol } from '../plugins/jwtAuth.js';
import { actualizarConfiguracionCajaBodySchema } from '../schemas/configuracionSchemas.js';

export async function configuracionRoutes(
  app: FastifyInstance,
  cajaFacade: CajaFacade,
): Promise<void> {
  const preHandlerOperacion = [
    autenticarJWT,
    requerirRol(['CAJERO', 'ENCARGADO']),
  ];
  const preHandlerEncargado = [autenticarJWT, requerirRol(['ENCARGADO'])];

  app.get(
    '/configuracion/caja',
    { preHandler: preHandlerOperacion },
    async () => {
      const configuracion = await cajaFacade.obtenerConfiguracionCaja();
      return { configuracion };
    },
  );

  app.patch(
    '/configuracion/caja',
    { preHandler: preHandlerEncargado },
    async (request, reply) => {
      const body = actualizarConfiguracionCajaBodySchema.parse(request.body);
      const configuracion = await cajaFacade.configurarRedondeo({
        idUsuarioEncargado: request.user.id_usuario,
        multiploRedondeoEfectivo: body.multiplo_redondeo_efectivo,
      });

      return reply.status(200).send({ configuracion });
    },
  );
}
