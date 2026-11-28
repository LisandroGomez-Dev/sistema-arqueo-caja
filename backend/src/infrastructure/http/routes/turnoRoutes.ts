import type { FastifyInstance } from 'fastify';
import type { CajaFacade } from '../../../application/facade/CajaFacade.js';
import { autenticarJWT, requerirRol } from '../plugins/jwtAuth.js';
import {
  anularMovimientoBodySchema,
  registrarMovimientoBodySchema,
} from '../schemas/movimientoSchemas.js';
import {
  abrirTurnoBodySchema,
  cerrarTurnoBodySchema,
} from '../schemas/turnoSchemas.js';

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

  app.get<{ Params: { idTurno: string } }>(
    '/turnos/:idTurno/movimientos',
    { preHandler: preHandlerOperacion },
    async (request) => {
      const movimientos = await cajaFacade.listarMovimientosTurno(
        request.params.idTurno,
        {
          idUsuario: request.user.id_usuario,
          rolUsuario: request.user.rol_usuario,
        },
      );
      return { movimientos };
    },
  );

  app.post<{ Params: { idTurno: string } }>(
    '/turnos/:idTurno/movimientos',
    { preHandler: preHandlerOperacion },
    async (request, reply) => {
      const body = registrarMovimientoBodySchema.parse(request.body);
      const resultado = await cajaFacade.registrarMovimiento({
        idTurno: request.params.idTurno,
        idUsuario: request.user.id_usuario,
        rolUsuario: request.user.rol_usuario,
        codigoMetodoPago: body.codigo_metodo_pago,
        tipoMovimiento: body.tipo_movimiento,
        montoOperacion: body.monto_operacion,
        conceptoDescripcion: body.concepto_descripcion ?? null,
        origenCarga: body.origen_carga,
        urlComprobante: body.url_comprobante ?? null,
      });

      return reply.status(201).send(resultado);
    },
  );

  app.patch<{ Params: { idMovimiento: string } }>(
    '/movimientos/:idMovimiento/anular',
    { preHandler: preHandlerEncargado },
    async (request, reply) => {
      const body = anularMovimientoBodySchema.parse(request.body);
      const resultado = await cajaFacade.anularMovimiento({
        idMovimiento: request.params.idMovimiento,
        idUsuarioEncargado: request.user.id_usuario,
        motivoAnulacion: body.motivo_anulacion,
        reemplazo: body.reemplazo
          ? {
              tipoMovimiento: body.reemplazo.tipo_movimiento,
              codigoMetodoPago: body.reemplazo.codigo_metodo_pago,
              montoOperacion: body.reemplazo.monto_operacion,
              conceptoDescripcion: body.reemplazo.concepto_descripcion,
            }
          : null,
      });

      return reply.status(200).send(resultado);
    },
  );

  app.post<{ Params: { idTurno: string } }>(
    '/turnos/:idTurno/cerrar',
    { preHandler: preHandlerOperacion },
    async (request, reply) => {
      const body = cerrarTurnoBodySchema.parse(request.body);
      const arqueo = await cajaFacade.cerrarTurno({
        idTurno: request.params.idTurno,
        idUsuarioCierre: request.user.id_usuario,
        rolUsuario: request.user.rol_usuario,
        efectivoDeclarado: body.efectivo_declarado,
        observacionesCierre: body.observaciones_cierre ?? null,
      });

      return reply.status(201).send({ arqueo });
    },
  );

  app.get<{ Params: { idArqueo: string } }>(
    '/arqueos/:idArqueo',
    { preHandler: preHandlerOperacion },
    async (request) => {
      const arqueo = await cajaFacade.obtenerArqueoPorId(
        request.params.idArqueo,
        {
          idUsuario: request.user.id_usuario,
          rolUsuario: request.user.rol_usuario,
        },
      );

      return { arqueo };
    },
  );
}
