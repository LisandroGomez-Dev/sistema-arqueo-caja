import { randomUUID } from 'node:crypto';
import { TurnoCaja } from '../../domain/entities/TurnoCaja.js';
import {
  CajaNoEncontradaError,
  CajaOcupadaError,
  TurnoYaAbiertoError,
  UsuarioNoEncontradoError,
} from '../../domain/errors/DominioError.js';
import { EstadoTurnoAbierto } from '../../domain/state/EstadoTurnoAbierto.js';
import { Dinero } from '../../domain/value-objects/Dinero.js';
import type { TurnoActivoDTO } from '../dto/TurnoActivoDTO.js';
import type { CajaRepositoryPort } from '../ports/out/CajaRepositoryPort.js';
import type { TurnoRepositoryPort } from '../ports/out/TurnoRepositoryPort.js';
import type { UsuarioRepositoryPort } from '../ports/out/UsuarioRepositoryPort.js';

export interface AbrirTurnoInput {
  idUsuario: string;
  idCaja: string;
  fondoInicialEfectivo: string;
}

/**
 * Caso de uso CU-AbrirCaja Multi-Caja (Issue #2 · RN-02, RN-05, RN-06).
 * Paraleliza todas las validaciones previas en una sola ronda contra la BD.
 */
export class AbrirTurnoUseCase {
  constructor(
    private readonly turnoRepo: TurnoRepositoryPort,
    private readonly usuarioRepo: UsuarioRepositoryPort,
    private readonly cajaRepo: CajaRepositoryPort,
  ) {}

  async ejecutar(input: AbrirTurnoInput): Promise<TurnoActivoDTO> {
    // Validar formato/invariante monetaria en memoria antes de tocar la BD (RN-06).
    const fondoInicial = Dinero.desde(input.fondoInicialEfectivo);
    const nuevoTurno = new TurnoCaja({
      idTurno: randomUUID(),
      idCaja: input.idCaja,
      idUsuarioApertura: input.idUsuario,
      fondoInicialEfectivo: fondoInicial,
      fechaHoraApertura: new Date(),
      fechaHoraCierre: null,
      estado: new EstadoTurnoAbierto(),
    });

    const [usuario, caja, turnoDelUsuario, turnoDeLaCaja] = await Promise.all([
      this.usuarioRepo.buscarPorId(input.idUsuario),
      this.cajaRepo.buscarPorId(input.idCaja),
      this.turnoRepo.buscarTurnoAbiertoPorUsuario(input.idUsuario),
      this.turnoRepo.buscarTurnoAbiertoPorCaja(input.idCaja),
    ]);

    if (!usuario || !usuario.estaActivo) {
      throw new UsuarioNoEncontradoError();
    }

    if (!caja || !caja.estaActiva) {
      throw new CajaNoEncontradaError();
    }

    if (turnoDelUsuario) {
      throw new TurnoYaAbiertoError();
    }

    if (turnoDeLaCaja) {
      throw new CajaOcupadaError();
    }

    const turnoGuardado = await this.turnoRepo.guardarNuevoTurno(nuevoTurno);
    return this.turnoRepo.obtenerResumenTurnoActivo(turnoGuardado);
  }
}
