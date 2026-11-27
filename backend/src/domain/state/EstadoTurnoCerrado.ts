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
}
