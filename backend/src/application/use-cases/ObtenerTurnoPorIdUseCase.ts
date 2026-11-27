import type { RolUsuario } from '../../domain/entities/Usuario.js';
import {
  RolNoAutorizadoError,
  TurnoNoEncontradoError,
} from '../../domain/errors/DominioError.js';
import type { TurnoActivoDTO } from '../dto/TurnoActivoDTO.js';
import type { TurnoRepositoryPort } from '../ports/out/TurnoRepositoryPort.js';

export class ObtenerTurnoPorIdUseCase {
  constructor(private readonly turnoRepo: TurnoRepositoryPort) {}

  async ejecutar(
    idTurno: string,
    usuarioSolicitante: { idUsuario: string; rolUsuario: RolUsuario },
  ): Promise<TurnoActivoDTO> {
    const turno = await this.turnoRepo.buscarPorId(idTurno);
    if (!turno) {
      throw new TurnoNoEncontradoError();
    }

    if (
      usuarioSolicitante.rolUsuario !== 'ENCARGADO' &&
      turno.idUsuarioApertura !== usuarioSolicitante.idUsuario
    ) {
      throw new RolNoAutorizadoError(
        'Solo podés consultar tu propia caja activa (RN-08).',
      );
    }

    return this.turnoRepo.obtenerResumenTurnoActivo(turno);
  }
}
