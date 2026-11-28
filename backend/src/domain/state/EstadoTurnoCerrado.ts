import type { MovimientoCaja } from '../entities/MovimientoCaja.js';
import type { TurnoCaja } from '../entities/TurnoCaja.js';
import type { Usuario } from '../entities/Usuario.js';
import { TurnoCerradoError } from '../errors/DominioError.js';
import type { CodigoEstadoTurno, EstadoTurno } from './EstadoTurno.js';

/**
 * Estado definitivo post-arqueo que bloquea nuevas operaciones (RN-05).
 */
export class EstadoTurnoCerrado implements EstadoTurno {
  obtenerCodigoEstado(): CodigoEstadoTurno {
    return 'CERRADO';
  }

  permiteModificaciones(): boolean {
    return false;
  }

  validarOperacion(): void {
    throw new TurnoCerradoError();
  }

  anularMovimiento(
    _turno: TurnoCaja,
    _movimiento: MovimientoCaja,
    _motivo: string,
    _encargado: Usuario,
  ): void {
    throw new TurnoCerradoError();
  }

  cerrar(_turno: TurnoCaja, _fechaCierre: Date): void {
    throw new TurnoCerradoError();
  }
}
