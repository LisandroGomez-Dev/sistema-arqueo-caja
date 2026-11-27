import type { Dinero } from '../../../domain/value-objects/Dinero.js';

export interface ConfiguracionCajaActual {
  idConfiguracion: string;
  nombreComercio: string;
  multiploRedondeoEfectivo: Dinero;
}

export interface ConfiguracionRepositoryPort {
  obtenerActual(): Promise<ConfiguracionCajaActual | null>;
}
