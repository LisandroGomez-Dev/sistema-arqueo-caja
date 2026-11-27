import type { CodigoEstadoTurno, EstadoTurno } from './EstadoTurno.js';

/**
 * Estado operativo cuando el turno está abierto y admite movimientos.
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
}
