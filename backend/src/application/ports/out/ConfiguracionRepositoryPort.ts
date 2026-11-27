import type { ConfiguracionCaja } from '../../../domain/entities/ConfiguracionCaja.js';

export interface ConfiguracionRepositoryPort {
  obtenerActual(): Promise<ConfiguracionCaja | null>;
  guardarActualizacion(config: ConfiguracionCaja): Promise<ConfiguracionCaja>;
}
