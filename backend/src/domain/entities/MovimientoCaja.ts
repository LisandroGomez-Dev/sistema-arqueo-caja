import {
  ConceptoObligatorioError,
  MontoInvalidoError,
} from '../errors/DominioError.js';
import { Dinero } from '../value-objects/Dinero.js';

export type TipoMovimiento = 'INGRESO' | 'EGRESO';
export type OrigenCarga = 'MANUAL' | 'IA_VOZ_TEXTO' | 'IA_COMPROBANTE';
export type EstadoMovimiento = 'ACTIVO' | 'ANULADO';

export interface MovimientoCajaProps {
  idMovimiento: string;
  idTurno: string;
  idMetodoPago: string;
  idUsuarioRegistro: string;
  tipoMovimiento: TipoMovimiento;
  montoOperacion: Dinero;
  conceptoDescripcion: string | null;
  origenCarga: OrigenCarga;
  urlComprobante: string | null;
  estadoMovimiento: EstadoMovimiento;
  motivoAnulacion: string | null;
  idUsuarioAnulacion: string | null;
  fechaHoraAnulacion: Date | null;
  fechaHoraRegistro: Date;
}

/**
 * Asiento inmutable del libro diario de un turno de caja (RN-01, RN-02, RN-06, RN-09).
 */
export class MovimientoCaja {
  readonly idMovimiento: string;
  readonly idTurno: string;
  readonly idMetodoPago: string;
  readonly idUsuarioRegistro: string;
  readonly tipoMovimiento: TipoMovimiento;
  readonly montoOperacion: Dinero;
  readonly conceptoDescripcion: string | null;
  readonly origenCarga: OrigenCarga;
  readonly urlComprobante: string | null;
  readonly estadoMovimiento: EstadoMovimiento;
  readonly motivoAnulacion: string | null;
  readonly idUsuarioAnulacion: string | null;
  readonly fechaHoraAnulacion: Date | null;
  readonly fechaHoraRegistro: Date;

  constructor(props: MovimientoCajaProps) {
    if (!props.montoOperacion.esPositivo()) {
      throw new MontoInvalidoError(
        'El importe del movimiento debe ser estrictamente mayor a $0,00 (RN-06).',
      );
    }

    const conceptoLimpio = props.conceptoDescripcion?.trim() || null;
    if (props.tipoMovimiento === 'EGRESO' && !conceptoLimpio) {
      throw new ConceptoObligatorioError();
    }

    this.idMovimiento = props.idMovimiento;
    this.idTurno = props.idTurno;
    this.idMetodoPago = props.idMetodoPago;
    this.idUsuarioRegistro = props.idUsuarioRegistro;
    this.tipoMovimiento = props.tipoMovimiento;
    this.montoOperacion = props.montoOperacion;
    this.conceptoDescripcion = conceptoLimpio;
    this.origenCarga = props.origenCarga;
    this.urlComprobante = props.urlComprobante?.trim() || null;
    this.estadoMovimiento = props.estadoMovimiento;
    this.motivoAnulacion = props.motivoAnulacion;
    this.idUsuarioAnulacion = props.idUsuarioAnulacion;
    this.fechaHoraAnulacion = props.fechaHoraAnulacion;
    this.fechaHoraRegistro = props.fechaHoraRegistro;
  }

  estaActivo(): boolean {
    return this.estadoMovimiento === 'ACTIVO';
  }

  /**
   * Devuelve +monto para INGRESO y -monto para EGRESO (0.00 si está ANULADO).
   */
  obtenerImporteConSigno(): Dinero {
    if (!this.estaActivo()) {
      return Dinero.cero();
    }
    return this.tipoMovimiento === 'INGRESO'
      ? this.montoOperacion
      : Dinero.cero().restar(this.montoOperacion);
  }
}
