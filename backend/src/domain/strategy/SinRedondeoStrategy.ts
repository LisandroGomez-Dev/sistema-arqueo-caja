import { Dinero } from '../value-objects/Dinero.js';
import type { EstrategiaRedondeo } from './EstrategiaRedondeo.js';

/**
 * Estrategia estricta / canales digitales (RN-03):
 * Nunca absorbe diferencias como ajuste de redondeo (ajuste = $0,00).
 */
export class SinRedondeoStrategy implements EstrategiaRedondeo {
  private readonly ajusteFijo: Dinero = Dinero.cero();

  calcularAjuste(_diferenciaBruta: Dinero): Dinero {
    return this.ajusteFijo;
  }
}
