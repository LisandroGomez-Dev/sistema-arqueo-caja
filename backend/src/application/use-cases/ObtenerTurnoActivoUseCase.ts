import type { TurnoActivoDTO } from '../dto/TurnoActivoDTO.js';
import type { TurnoRepositoryPort } from '../ports/out/TurnoRepositoryPort.js';

export class ObtenerTurnoActivoUseCase {
  constructor(private readonly turnoRepo: TurnoRepositoryPort) {}

  async ejecutar(idUsuario: string): Promise<TurnoActivoDTO | null> {
    const turno = await this.turnoRepo.buscarTurnoAbiertoPorUsuario(idUsuario);
    if (!turno) {
      return null;
    }
    return this.turnoRepo.obtenerResumenTurnoActivo(turno);
  }
}
