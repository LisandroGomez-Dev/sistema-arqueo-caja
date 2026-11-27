import type { Dinero } from '../value-objects/Dinero.js';

/**
 * Patrón GoF Strategy (RN-03, RN-04):
 * Encapsula el algoritmo de ajuste por redondeo/tolerancia aplicable a la diferencia bruta.
 */
export interface EstrategiaRedondeo {
  calcularAjuste(diferenciaBruta: Dinero): Dinero;
}
