import type { ArqueoCierre } from '../../../domain/entities/ArqueoCierre.js';
import type { TurnoCaja } from '../../../domain/entities/TurnoCaja.js';
import type { ArqueoCierreDTO } from '../../dto/ArqueoDTO.js';

export interface ArqueoRepositoryPort {
  guardarCierreAtomico(
    turnoCerrado: TurnoCaja,
    arqueo: ArqueoCierre,
  ): Promise<ArqueoCierreDTO>;
  buscarPorId(idArqueo: string): Promise<ArqueoCierreDTO | null>;
}
