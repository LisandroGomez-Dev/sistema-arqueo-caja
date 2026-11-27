import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import * as Sentry from '@sentry/node';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import type { CajaFacade } from '../../application/facade/CajaFacade.js';
import { DominioError } from '../../domain/errors/DominioError.js';
import { authRoutes } from './routes/authRoutes.js';
import { healthRoutes } from './routes/healthRoutes.js';
import { turnoRoutes } from './routes/turnoRoutes.js';

export interface BuildAppOptions {
  cajaFacade: CajaFacade;
  jwtSecret: string;
  frontendUrls: string[];
  enableSentry?: boolean;
}

export function buildApp(options: BuildAppOptions): FastifyInstance {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  });

  app.register(cors, {
    origin: options.frontendUrls,
    credentials: true,
    maxAge: 86400,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });

  app.register(jwt, {
    secret: options.jwtSecret,
  });

  if (options.enableSentry) {
    Sentry.setupFastifyErrorHandler(app);
  }

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof DominioError) {
      return reply.status(error.statusHttp).send({
        codigo: error.codigo,
        message: error.message,
      });
    }

    if (error instanceof ZodError) {
      const primerError = error.issues[0];
      return reply.status(400).send({
        codigo: 'VALIDACION_ENTRADA',
        message: primerError?.message ?? 'Los datos enviados no son válidos.',
        detalles: error.issues,
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      codigo: 'ERROR_INTERNO',
      message: 'Ocurrió un error inesperado en el servidor.',
    });
  });

  app.register(
    async (api) => {
      await healthRoutes(api);
      await authRoutes(api, options.cajaFacade);
      await turnoRoutes(api, options.cajaFacade);
    },
    { prefix: '/api/v1' },
  );

  return app;
}
