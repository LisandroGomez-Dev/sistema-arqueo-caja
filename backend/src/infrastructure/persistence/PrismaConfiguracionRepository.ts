import type { PrismaClient } from '@prisma/client';
import type { ConfiguracionRepositoryPort } from '../../application/ports/out/ConfiguracionRepositoryPort.js';
import { ConfiguracionCaja } from '../../domain/entities/ConfiguracionCaja.js';
import { Dinero } from '../../domain/value-objects/Dinero.js';
import type { CatalogoCache } from './CatalogoCache.js';

export class PrismaConfiguracionRepository implements ConfiguracionRepositoryPort {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly catalogo: CatalogoCache,
  ) {}

  async obtenerActual(): Promise<ConfiguracionCaja | null> {
    const snap = await this.catalogo.obtener();
    if (!snap.configuracion) {
      return null;
    }

    return new ConfiguracionCaja({
      idConfiguracion: snap.configuracion.idConfiguracion,
      nombreComercio: snap.configuracion.nombreComercio,
      multiploRedondeoEfectivo: snap.configuracion.multiploRedondeoEfectivo,
      idUsuarioActualizacion: snap.configuracion.idUsuarioActualizacion,
      fechaUltimaActualizacion: snap.configuracion.fechaUltimaActualizacion,
    });
  }

  async guardarActualizacion(
    config: ConfiguracionCaja,
  ): Promise<ConfiguracionCaja> {
    const actualizada = await this.prisma.configuracionCaja.update({
      where: { id_configuracion: config.idConfiguracion },
      data: {
        multiplo_redondeo_efectivo: config
          .getMultiploRedondeoEfectivo()
          .aString(),
        id_usuario_actualizacion: config.idUsuarioActualizacion,
        fecha_ultima_actualizacion: config.fechaUltimaActualizacion,
      },
    });

    this.catalogo.invalidar();

    return new ConfiguracionCaja({
      idConfiguracion: actualizada.id_configuracion,
      nombreComercio: actualizada.nombre_comercio,
      multiploRedondeoEfectivo: Dinero.desde(
        actualizada.multiplo_redondeo_efectivo.toString(),
      ),
      idUsuarioActualizacion: actualizada.id_usuario_actualizacion,
      fechaUltimaActualizacion: actualizada.fecha_ultima_actualizacion,
    });
  }
}
