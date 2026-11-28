import type { MovimientoCaja } from '../entities/MovimientoCaja.js';
import type { TurnoCaja } from '../entities/TurnoCaja.js';
import type { Usuario } from '../entities/Usuario.js';
import { MovimientoYaAnuladoError } from '../errors/DominioError.js';
import type { CodigoEstadoTurno, EstadoTurno } from './EstadoTurno.js';
import { EstadoTurnoCerrado } from './EstadoTurnoCerrado.js';

/**
 * Estado operativo cuando el turno está abierto y admite movimientos o anulaciones.
 */
export class EstadoTurnoAbierto implements EstadoTurno {
  obtenerCodigoEstado(): CodigoEstadoTurno {
    return 'ABIERTO';
  }

  permiteModificaciones(): boolean {
    return true;
  }

  validarOperacion(): void {
    // Un turno abierto permite registrar movimientos y operar normalmente.
  }

  anularMovimiento(
    _turno: TurnoCaja,
    movimiento: MovimientoCaja,
    motivo: string,
    encargado: Usuario,
  ): void {
    if (!movimiento.estaActivo()) {
      throw new MovimientoYaAnuladoError();
    }
    movimiento.anular(motivo, encargado);
  }

  cerrar(turno: TurnoCaja, fechaCierre: Date): void {
    turno.fechaHoraCierre = fechaCierre;
    turno.cambiarEstado(new EstadoTurnoCerrado());
  }
}
