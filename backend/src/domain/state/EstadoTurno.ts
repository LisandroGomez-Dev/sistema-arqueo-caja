export type CodigoEstadoTurno = 'ABIERTO' | 'CERRADO';

/**
 * Patrón State (GoF) para el ciclo de vida de un turno de caja (RN-05).
 */
export interface EstadoTurno {
  obtenerCodigoEstado(): CodigoEstadoTurno;
  permiteModificaciones(): boolean;
  validarOperacion(): void;
}
