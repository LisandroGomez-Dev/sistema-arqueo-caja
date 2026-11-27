import {
  ConceptoObligatorioError,
  MontoInvalidoError,
  MotivoAnulacionObligatorioError,
  MovimientoYaAnuladoError,
  RolNoAutorizadoError,
} from '../errors/DominioError.js';
import { Dinero } from '../value-objects/Dinero.js';
import type { Usuario } from './Usuario.js';

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
  readonly fechaHoraRegistro: Date;

  private _estadoMovimiento: EstadoMovimiento;
  private _motivoAnulacion: string | null;
  private _idUsuarioAnulacion: string | null;
  private _fechaHoraAnulacion: Date | null;

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
    this.fechaHoraRegistro = props.fechaHoraRegistro;

    this._estadoMovimiento = props.estadoMovimiento;
    this._motivoAnulacion = props.motivoAnulacion;
    this._idUsuarioAnulacion = props.idUsuarioAnulacion;
    this._fechaHoraAnulacion = props.fechaHoraAnulacion;
  }

  get estadoMovimiento(): EstadoMovimiento {
    return this._estadoMovimiento;
  }

  get motivoAnulacion(): string | null {
    return this._motivoAnulacion;
  }

  get idUsuarioAnulacion(): string | null {
    return this._idUsuarioAnulacion;
  }

  get fechaHoraAnulacion(): Date | null {
    return this._fechaHoraAnulacion;
  }

  estaActivo(): boolean {
    return this._estadoMovimiento === 'ACTIVO';
  }

  /**
   * Anulación lógica simple (RN-01, RN-08): nunca elimina el registro ni altera monto/método.
   */
  anular(motivo: string, encargado: Usuario): void {
    if (!encargado.puedeAnular()) {
      throw new RolNoAutorizadoError(
        'Solo un usuario con rol ENCARGADO puede anular movimientos (RN-08).',
      );
    }

    if (!this.estaActivo()) {
      throw new MovimientoYaAnuladoError();
    }

    const motivoLimpio = motivo.trim();
    if (motivoLimpio.length < 3) {
      throw new MotivoAnulacionObligatorioError();
    }

    this._estadoMovimiento = 'ANULADO';
    this._motivoAnulacion = motivoLimpio;
    this._idUsuarioAnulacion = encargado.idUsuario;
    this._fechaHoraAnulacion = new Date();
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
