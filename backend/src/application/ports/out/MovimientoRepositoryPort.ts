import type { MovimientoCaja } from '../../../domain/entities/MovimientoCaja.js';
import type { MovimientoDTO } from '../../dto/MovimientoDTO.js';

export interface MovimientoRepositoryPort {
  guardar(movimiento: MovimientoCaja): Promise<MovimientoDTO>;
  listarPorTurno(idTurno: string): Promise<MovimientoDTO[]>;
}
