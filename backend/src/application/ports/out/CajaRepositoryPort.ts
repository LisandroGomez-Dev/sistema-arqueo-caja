import type { Caja } from '../../../domain/entities/Caja.js';
import type { CajaConEstadoDTO } from '../../dto/TurnoActivoDTO.js';

export interface CajaRepositoryPort {
  buscarPorId(idCaja: string): Promise<Caja | null>;
  listarActivasConEstado(): Promise<CajaConEstadoDTO[]>;
}
