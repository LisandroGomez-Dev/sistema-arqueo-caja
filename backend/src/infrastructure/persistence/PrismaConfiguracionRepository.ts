import type { PrismaClient } from '@prisma/client';
import type {
  ConfiguracionCajaActual,
  ConfiguracionRepositoryPort,
} from '../../application/ports/out/ConfiguracionRepositoryPort.js';
import { Dinero } from '../../domain/value-objects/Dinero.js';

export class PrismaConfiguracionRepository implements ConfiguracionRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async obtenerActual(): Promise<ConfiguracionCajaActual | null> {
    const config = await this.prisma.configuracionCaja.findFirst({
      orderBy: { fecha_ultima_actualizacion: 'desc' },
    });

    if (!config) {
      return null;
    }

    return {
      idConfiguracion: config.id_configuracion,
      nombreComercio: config.nombre_comercio,
      multiploRedondeoEfectivo: Dinero.desde(config.multiplo_redondeo_efectivo.toString()),
    };
  }
}
