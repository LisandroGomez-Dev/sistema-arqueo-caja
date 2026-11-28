import 'dotenv/config';
import './instrument.js';
import { CajaFacade } from './application/facade/CajaFacade.js';
import { buildApp } from './infrastructure/http/app.js';
import { CatalogoCache } from './infrastructure/persistence/CatalogoCache.js';
import { prisma } from './infrastructure/persistence/prismaClient.js';
import { PrismaArqueoRepository } from './infrastructure/persistence/PrismaArqueoRepository.js';
import { PrismaCajaRepository } from './infrastructure/persistence/PrismaCajaRepository.js';
import { PrismaConfiguracionRepository } from './infrastructure/persistence/PrismaConfiguracionRepository.js';
import { PrismaMetodoPagoRepository } from './infrastructure/persistence/PrismaMetodoPagoRepository.js';
import { PrismaMovimientoRepository } from './infrastructure/persistence/PrismaMovimientoRepository.js';
import { PrismaTurnoRepository } from './infrastructure/persistence/PrismaTurnoRepository.js';
import { PrismaUsuarioRepository } from './infrastructure/persistence/PrismaUsuarioRepository.js';
import { BcryptPinHasher } from './infrastructure/security/BcryptPinHasher.js';

function obtenerJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('La variable de entorno JWT_SECRET es obligatoria en producción.');
  }

  console.warn(
    'AVISO: JWT_SECRET no definida en .env; usando secreto temporal solo para desarrollo local.',
  );
  return 'dev-only-jwt-secret-cambiar-en-env';
}

function obtenerFrontendUrls(): string[] {
  const raw = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  return raw
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
}

async function start(): Promise<void> {
  const port = Number(process.env.PORT ?? 3000);
  const jwtSecret = obtenerJwtSecret();
  const frontendUrls = obtenerFrontendUrls();
  const enableSentry = Boolean(process.env.SENTRY_DSN?.trim());

  const catalogo = new CatalogoCache(prisma);

  const cajaFacade = new CajaFacade({
    turnoRepo: new PrismaTurnoRepository(prisma, catalogo),
    usuarioRepo: new PrismaUsuarioRepository(prisma, catalogo),
    cajaRepo: new PrismaCajaRepository(prisma, catalogo),
    configRepo: new PrismaConfiguracionRepository(prisma, catalogo),
    metodoPagoRepo: new PrismaMetodoPagoRepository(catalogo),
    movimientoRepo: new PrismaMovimientoRepository(prisma, catalogo),
    arqueoRepo: new PrismaArqueoRepository(prisma, catalogo),
    pinHasher: new BcryptPinHasher(),
  });

  const app = buildApp({
    cajaFacade,
    jwtSecret,
    frontendUrls,
    enableSentry,
  });

  try {
    // Pre-calentar conexión y catálogos en paralelo para que el primer request sea instantáneo.
    await Promise.all([
      app.listen({ port, host: '0.0.0.0' }),
      catalogo.obtener().catch(() => null),
    ]);
    console.log(`Backend ArqueoCaja escuchando en http://localhost:${port}/api/v1`);
  } catch (error) {
    app.log.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

void start();
