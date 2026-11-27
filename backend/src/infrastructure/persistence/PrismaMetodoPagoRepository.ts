import type { MetodoPagoRepositoryPort } from '../../application/ports/out/MetodoPagoRepositoryPort.js';
import type { MetodoPago } from '../../domain/entities/MetodoPago.js';
import type { CatalogoCache } from './CatalogoCache.js';

export class PrismaMetodoPagoRepository implements MetodoPagoRepositoryPort {
  constructor(private readonly catalogo: CatalogoCache) {}

  async buscarActivoPorCodigo(codigoMetodo: string): Promise<MetodoPago | null> {
    const snap = await this.catalogo.obtener();
    return snap.metodosPorCodigo.get(codigoMetodo.trim().toUpperCase()) ?? null;
  }
}
