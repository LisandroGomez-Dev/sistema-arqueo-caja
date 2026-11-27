import {
  MontoInvalidoError,
  MovimientoNoEncontradoError,
} from '../errors/DominioError.js';
import type { CodigoEstadoTurno, EstadoTurno } from '../state/EstadoTurno.js';
import { Dinero } from '../value-objects/Dinero.js';
import type { MetodoPago } from './MetodoPago.js';
import type { MovimientoCaja } from './MovimientoCaja.js';
import type { Usuario } from './Usuario.js';

export interface TurnoCajaProps {
  idTurno: string;
  idCaja: string;
  idUsuarioApertura: string;
  fondoInicialEfectivo: Dinero;
  fechaHoraApertura: Date;
  fechaHoraCierre: Date | null;
  estado: EstadoTurno;
}

/**
 * Sesión laboral de una caja física con ciclo de vida regido por State (RN-02, RN-05, RN-06).
 */
export class TurnoCaja {
  readonly idTurno: string;
  readonly idCaja: string;
  readonly idUsuarioApertura: string;
  readonly fondoInicialEfectivo: Dinero;
  readonly fechaHoraApertura: Date;
  fechaHoraCierre: Date | null;
  private estado: EstadoTurno;

  constructor(props: TurnoCajaProps) {
    if (props.fondoInicialEfectivo.esNegativo()) {
      throw new MontoInvalidoError(
        'El fondo inicial en efectivo debe ser mayor o igual a $0,00 (RN-06).',
      );
    }

    this.idTurno = props.idTurno;
    this.idCaja = props.idCaja;
    this.idUsuarioApertura = props.idUsuarioApertura;
    this.fondoInicialEfectivo = props.fondoInicialEfectivo;
    this.fechaHoraApertura = props.fechaHoraApertura;
    this.fechaHoraCierre = props.fechaHoraCierre;
    this.estado = props.estado;
  }

  obtenerCodigoEstado(): CodigoEstadoTurno {
    return this.estado.obtenerCodigoEstado();
  }

  permiteModificaciones(): boolean {
    return this.estado.permiteModificaciones();
  }

  validarOperacion(): void {
    this.estado.validarOperacion();
  }

  anularMovimiento(
    movimiento: MovimientoCaja,
    motivo: string,
    encargado: Usuario,
  ): void {
    if (movimiento.idTurno !== this.idTurno) {
      throw new MovimientoNoEncontradoError(
        'El movimiento indicado no pertenece a este turno de caja.',
      );
    }
    this.estado.anularMovimiento(this, movimiento, motivo, encargado);
  }

  cambiarEstado(nuevoEstado: EstadoTurno): void {
    this.estado = nuevoEstado;
  }

  /**
   * Calcula el saldo base al abrir turno para cada método de pago (RN-02):
   * solo EFECTIVO recibe el fondo inicial; los canales digitales inician en $0,00.
   */
  calcularEsperadoInicialPorMetodo(metodo: MetodoPago): Dinero {
    return metodo.esEfectivo() ? this.fondoInicialEfectivo : Dinero.cero();
  }
}
