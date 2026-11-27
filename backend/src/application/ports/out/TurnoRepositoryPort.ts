import type { TurnoCaja } from '../../../domain/entities/TurnoCaja.js';
import type { TurnoActivoDTO } from '../../dto/TurnoActivoDTO.js';

export interface TurnoRepositoryPort {
  buscarPorId(idTurno: string): Promise<TurnoCaja | null>;
  buscarTurnoAbiertoPorUsuario(idUsuario: string): Promise<TurnoCaja | null>;
  buscarTurnoAbiertoPorCaja(idCaja: string): Promise<TurnoCaja | null>;
  listarTurnosAbiertos(): Promise<TurnoActivoDTO[]>;
  guardarNuevoTurno(turno: TurnoCaja): Promise<TurnoCaja>;
  obtenerResumenTurnoActivo(turno: TurnoCaja): Promise<TurnoActivoDTO>;
}
