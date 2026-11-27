export interface CajaProps {
  idCaja: string;
  numeroCaja: number;
  nombreCaja: string;
  estaActiva: boolean;
}

/**
 * Terminal física / punto de cobro habilitado dentro del comercio (Multi-Caja · RN-05).
 */
export class Caja {
  readonly idCaja: string;
  readonly numeroCaja: number;
  readonly nombreCaja: string;
  readonly estaActiva: boolean;

  constructor(props: CajaProps) {
    this.idCaja = props.idCaja;
    this.numeroCaja = props.numeroCaja;
    this.nombreCaja = props.nombreCaja;
    this.estaActiva = props.estaActiva;
  }

  estaHabilitada(): boolean {
    return this.estaActiva;
  }

  obtenerEtiqueta(): string {
    return `Caja #${this.numeroCaja} — ${this.nombreCaja}`;
  }
}
