import type { FastifyInstance } from 'fastify';
import type { CajaFacade } from '../../../application/facade/CajaFacade.js';
import { autenticarJWT, requerirRol } from '../plugins/jwtAuth.js';
import { abrirTurnoBodySchema } from '../schemas/turnoSchemas.js';

export async function turnoRoutes(
  app: FastifyInstance,
  cajaFacade: CajaFacade,
): Promise<void> {
  const preHandlerOperacion = [
    autenticarJWT,
    requerirRol(['CAJERO', 'ENCARGADO']),
  ];

  const preHandlerEncargado = [autenticarJWT, requerirRol(['ENCARGADO'])];

  app.get(
    '/cajas',
    { preHandler: preHandlerOperacion },
    async () => {
      const cajas = await cajaFacade.listarCajasConEstado();
      return { cajas };
    },
  );

  app.get(
    '/turnos/activo',
    { preHandler: preHandlerOperacion },
    async (request) => {
      const turno = await cajaFacade.obtenerTurnoActivo(request.user.id_usuario);
      return { turno };
    },
  );

  app.get(
    '/turnos/activos',
    { preHandler: preHandlerEncargado },
    async () => {
      const [turnos, cajas] = await Promise.all([
        cajaFacade.listarTurnosActivos(),
        cajaFacade.listarCajasConEstado(),
      ]);
      return { turnos, cajas };
    },
  );

  app.get<{ Params: { idTurno: string } }>(
    '/turnos/:idTurno',
    { preHandler: preHandlerOperacion },
    async (request) => {
      const turno = await cajaFacade.obtenerTurnoPorId(request.params.idTurno, {
        idUsuario: request.user.id_usuario,
        rolUsuario: request.user.rol_usuario,
      });
      return { turno };
    },
  );

  app.post(
    '/turnos/abrir',
    { preHandler: preHandlerOperacion },
    async (request, reply) => {
      const body = abrirTurnoBodySchema.parse(request.body);
      const turno = await cajaFacade.abrirTurno(
        request.user.id_usuario,
        body.id_caja,
        body.fondo_inicial_efectivo,
      );

      return reply.status(201).send({ turno });
    },
  );
}
