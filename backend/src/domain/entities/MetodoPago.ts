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
}
