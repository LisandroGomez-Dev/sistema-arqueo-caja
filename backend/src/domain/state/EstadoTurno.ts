import type { MovimientoCaja } from '../entities/MovimientoCaja.js';
import type { TurnoCaja } from '../entities/TurnoCaja.js';
import type { Usuario } from '../entities/Usuario.js';

export type CodigoEstadoTurno = 'ABIERTO' | 'CERRADO';

/**
 * Patrón State (GoF) para el ciclo de vida de un turno de caja (RN-05).
 */
export interface EstadoTurno {
  obtenerCodigoEstado(): CodigoEstadoTurno;
  permiteModificaciones(): boolean;
  validarOperacion(): void;
  anularMovimiento(
    turno: TurnoCaja,
    movimiento: MovimientoCaja,
    motivo: string,
    encargado: Usuario,
  ): void;
  cerrar(turno: TurnoCaja, fechaCierre: Date): void;
}
