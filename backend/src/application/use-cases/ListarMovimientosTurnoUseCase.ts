import type { RolUsuario } from '../../domain/entities/Usuario.js';
import {
  RolNoAutorizadoError,
  TurnoNoEncontradoError,
} from '../../domain/errors/DominioError.js';
import type { MovimientoDTO } from '../dto/MovimientoDTO.js';
import type { MovimientoRepositoryPort } from '../ports/out/MovimientoRepositoryPort.js';
import type { TurnoRepositoryPort } from '../ports/out/TurnoRepositoryPort.js';

export class ListarMovimientosTurnoUseCase {
  constructor(
    private readonly turnoRepo: TurnoRepositoryPort,
    private readonly movimientoRepo: MovimientoRepositoryPort,
  ) {}

  async ejecutar(
    idTurno: string,
    solicitante: { idUsuario: string; rolUsuario: RolUsuario },
  ): Promise<MovimientoDTO[]> {
    const [turno, movimientos] = await Promise.all([
      this.turnoRepo.buscarPorId(idTurno),
      this.movimientoRepo.listarPorTurno(idTurno),
    ]);

    if (!turno) {
      throw new TurnoNoEncontradoError();
    }

    if (
      solicitante.rolUsuario !== 'ENCARGADO' &&
      turno.idUsuarioApertura !== solicitante.idUsuario
    ) {
      throw new RolNoAutorizadoError(
        'Solo podés consultar los movimientos de tu propia caja activa (RN-08).',
      );
    }

    return movimientos;
  }
}
