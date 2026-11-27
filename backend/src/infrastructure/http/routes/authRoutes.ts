import type { FastifyInstance } from 'fastify';
import type { CajaFacade } from '../../../application/facade/CajaFacade.js';
import { autenticarJWT } from '../plugins/jwtAuth.js';
import { loginBodySchema } from '../schemas/authSchemas.js';

export async function authRoutes(
  app: FastifyInstance,
  cajaFacade: CajaFacade,
): Promise<void> {
  app.get('/auth/operadores', async () => {
    const [operadores, configuracion] = await Promise.all([
      cajaFacade.listarOperadoresActivos(),
      cajaFacade.obtenerConfiguracionPublica(),
    ]);

    return {
      operadores,
      comercio: configuracion,
    };
  });

  app.post('/auth/login', async (request, reply) => {
    const body = loginBodySchema.parse(request.body);
    const usuario = await cajaFacade.autenticarUsuario(body.id_usuario, body.pin);

    const [token, turno] = await Promise.all([
      reply.jwtSign(
        {
          id_usuario: usuario.id_usuario,
          nombre_completo: usuario.nombre_completo,
          rol_usuario: usuario.rol_usuario,
        },
        { expiresIn: '12h' },
      ),
      cajaFacade.obtenerTurnoActivo(usuario.id_usuario),
    ]);

    return reply.status(200).send({
      token,
      usuario,
      turno,
    });
  });

  app.get(
    '/auth/me',
    { preHandler: [autenticarJWT] },
    async (request) => {
      return {
        usuario: request.user,
      };
    },
  );
}
