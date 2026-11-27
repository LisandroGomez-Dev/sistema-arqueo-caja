import type { MetodoPago } from '../../../domain/entities/MetodoPago.js';

export interface MetodoPagoRepositoryPort {
  buscarActivoPorCodigo(codigoMetodo: string): Promise<MetodoPago | null>;
}
