import { MontoInvalidoError } from '../errors/DominioError.js';
import { Dinero } from '../value-objects/Dinero.js';
import type { EstrategiaRedondeo } from './EstrategiaRedondeo.js';

/**
 * Estrategia de tolerancia / redondeo comercial en efectivo (RN-04, RN-07):
 * - Si el faltante en valor absoluto es estrictamente menor al margen configurado,
 *   se absorbe completo en ajuste_redondeo (diferencia_real = 0.00).
 * - Si el faltante es >= al margen, o hay sobrante (> 0) o cuadre exacto (0),
 *   el ajuste es 0.00 y toda la diferencia pasa a diferencia_real.
 */
export class RedondeoComercialStrategy implements EstrategiaRedondeo {
  private readonly multiplo: Dinero;

  constructor(multiplo: Dinero) {
    if (multiplo.esNegativo()) {
      throw new MontoInvalidoError(
        'El margen de tolerancia/redondeo no puede ser negativo (RN-04, RN-06).',
      );
    }
    this.multiplo = multiplo;
  }

  calcularAjuste(diferenciaBruta: Dinero): Dinero {
    if (this.multiplo.esCero()) {
      return Dinero.cero();
    }

    if (
      diferenciaBruta.esNegativo() &&
      diferenciaBruta.absoluto().menorQue(this.multiplo)
    ) {
      return diferenciaBruta;
    }

    return Dinero.cero();
  }
}
