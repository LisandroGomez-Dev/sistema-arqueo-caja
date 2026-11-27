import type {
  ConfiguracionCajaActual,
  ConfiguracionRepositoryPort,
} from '../../application/ports/out/ConfiguracionRepositoryPort.js';
import type { CatalogoCache } from './CatalogoCache.js';

export class PrismaConfiguracionRepository implements ConfiguracionRepositoryPort {
  constructor(private readonly catalogo: CatalogoCache) {}

  async obtenerActual(): Promise<ConfiguracionCajaActual | null> {
    const snap = await this.catalogo.obtener();
    if (!snap.configuracion) {
      return null;
    }
    return {
      idConfiguracion: snap.configuracion.idConfiguracion,
      nombreComercio: snap.configuracion.nombreComercio,
      multiploRedondeoEfectivo: snap.configuracion.multiploRedondeoEfectivo,
    };
  }
}
