import type { EstrategiaRedondeo } from '../strategy/EstrategiaRedondeo.js';
import { RedondeoComercialStrategy } from '../strategy/RedondeoComercialStrategy.js';
import { SinRedondeoStrategy } from '../strategy/SinRedondeoStrategy.js';
import type { Dinero } from '../value-objects/Dinero.js';

export type CodigoMetodoPago = 'EFECTIVO' | 'QR_TRANSFERENCIA' | 'TARJETA';

export interface MetodoPagoProps {
  idMetodoPago: string;
  codigoMetodo: CodigoMetodoPago | string;
  nombreMetodo: string;
  permiteRedondeo: boolean;
  estaActivo: boolean;
}

/**
 * Canal de pago del mostrador (RN-02, RN-03).
 */
export class MetodoPago {
  readonly idMetodoPago: string;
  readonly codigoMetodo: CodigoMetodoPago | string;
  readonly nombreMetodo: string;
  readonly permiteRedondeo: boolean;
  readonly estaActivo: boolean;

  constructor(props: MetodoPagoProps) {
    this.idMetodoPago = props.idMetodoPago;
    this.codigoMetodo = props.codigoMetodo;
    this.nombreMetodo = props.nombreMetodo;
    this.permiteRedondeo = props.permiteRedondeo;
    this.estaActivo = props.estaActivo;
  }

  esEfectivo(): boolean {
    return this.codigoMetodo === 'EFECTIVO';
  }

  /**
   * Selecciona polimórficamente la EstrategiaRedondeo aplicable al canal (RN-03, RN-04).
   */
  obtenerEstrategiaRedondeo(multiplo: Dinero): EstrategiaRedondeo {
    if (!this.permiteRedondeo || multiplo.esCero()) {
      return new SinRedondeoStrategy();
    }
    return new RedondeoComercialStrategy(multiplo);
  }
}
