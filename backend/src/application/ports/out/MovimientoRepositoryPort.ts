import type { MovimientoCaja } from '../../../domain/entities/MovimientoCaja.js';
import type { MovimientoDTO } from '../../dto/MovimientoDTO.js';

export interface MovimientoRepositoryPort {
  buscarPorId(idMovimiento: string): Promise<MovimientoCaja | null>;
  guardar(movimiento: MovimientoCaja): Promise<MovimientoDTO>;
  actualizarAnulacion(movimiento: MovimientoCaja): Promise<MovimientoDTO>;
  anularYReemplazar(
    movimientoAnulado: MovimientoCaja,
    movimientoReemplazo: MovimientoCaja,
  ): Promise<{
    movimiento: MovimientoDTO;
    movimientoReemplazo: MovimientoDTO;
  }>;
  listarPorTurno(idTurno: string): Promise<MovimientoDTO[]>;
}
