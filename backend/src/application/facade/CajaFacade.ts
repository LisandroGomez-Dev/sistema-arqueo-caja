import type { RolUsuario } from '../../domain/entities/Usuario.js';
import {
  CajaOcupadaError,
  TurnoYaAbiertoError,
} from '../../domain/errors/DominioError.js';
import type {
  CajaConEstadoDTO,
  ConfiguracionPublicaDTO,
  OperadorPublicoDTO,
  TurnoActivoDTO,
} from '../dto/TurnoActivoDTO.js';
import type { CajaRepositoryPort } from '../ports/out/CajaRepositoryPort.js';
import type { ConfiguracionRepositoryPort } from '../ports/out/ConfiguracionRepositoryPort.js';
import type { PinHasherPort } from '../ports/out/PinHasherPort.js';
import type { TurnoRepositoryPort } from '../ports/out/TurnoRepositoryPort.js';
import type { UsuarioRepositoryPort } from '../ports/out/UsuarioRepositoryPort.js';
import { AbrirTurnoUseCase } from '../use-cases/AbrirTurnoUseCase.js';
import { AutenticarUsuarioUseCase } from '../use-cases/AutenticarUsuarioUseCase.js';
import { ObtenerTurnoActivoUseCase } from '../use-cases/ObtenerTurnoActivoUseCase.js';
import { ObtenerTurnoPorIdUseCase } from '../use-cases/ObtenerTurnoPorIdUseCase.js';

export interface CajaFacadeDependencies {
  turnoRepo: TurnoRepositoryPort;
  usuarioRepo: UsuarioRepositoryPort;
  cajaRepo: CajaRepositoryPort;
  configRepo: ConfiguracionRepositoryPort;
  pinHasher: PinHasherPort;
}

/**
 * Patrón Facade (GoF): punto de entrada único para operaciones multi-caja.
 */
export class CajaFacade {
  private readonly turnoRepo: TurnoRepositoryPort;
  private readonly usuarioRepo: UsuarioRepositoryPort;
  private readonly cajaRepo: CajaRepositoryPort;
  private readonly configRepo: ConfiguracionRepositoryPort;
  private readonly autenticarUsuarioUC: AutenticarUsuarioUseCase;
  private readonly abrirTurnoUC: AbrirTurnoUseCase;
  private readonly obtenerTurnoActivoUC: ObtenerTurnoActivoUseCase;
  private readonly obtenerTurnoPorIdUC: ObtenerTurnoPorIdUseCase;

  constructor(deps: CajaFacadeDependencies) {
    this.turnoRepo = deps.turnoRepo;
    this.usuarioRepo = deps.usuarioRepo;
    this.cajaRepo = deps.cajaRepo;
    this.configRepo = deps.configRepo;
    this.autenticarUsuarioUC = new AutenticarUsuarioUseCase(deps.usuarioRepo, deps.pinHasher);
    this.abrirTurnoUC = new AbrirTurnoUseCase(deps.turnoRepo, deps.usuarioRepo, deps.cajaRepo);
    this.obtenerTurnoActivoUC = new ObtenerTurnoActivoUseCase(deps.turnoRepo);
    this.obtenerTurnoPorIdUC = new ObtenerTurnoPorIdUseCase(deps.turnoRepo);
  }

  async listarOperadoresActivos(): Promise<OperadorPublicoDTO[]> {
    return this.usuarioRepo.listarActivos();
  }

  async listarCajasConEstado(): Promise<CajaConEstadoDTO[]> {
    return this.cajaRepo.listarActivasConEstado();
  }

  async obtenerConfiguracionPublica(): Promise<ConfiguracionPublicaDTO> {
    const config = await this.configRepo.obtenerActual();
    if (!config) {
      return {
        nombre_comercio: 'Comercio ArqueoCaja',
        multiplo_redondeo_efectivo: '0.00',
      };
    }
    return {
      nombre_comercio: config.nombreComercio,
      multiplo_redondeo_efectivo: config.multiploRedondeoEfectivo.aString(),
    };
  }

  async autenticarUsuario(idUsuario: string, pin: string): Promise<OperadorPublicoDTO> {
    return this.autenticarUsuarioUC.ejecutar(idUsuario, pin);
  }

  async validarSinTurnoAbierto(idUsuario: string, idCaja: string): Promise<void> {
    const [delUsuario, deLaCaja] = await Promise.all([
      this.turnoRepo.buscarTurnoAbiertoPorUsuario(idUsuario),
      this.turnoRepo.buscarTurnoAbiertoPorCaja(idCaja),
    ]);
    if (delUsuario) {
      throw new TurnoYaAbiertoError();
    }
    if (deLaCaja) {
      throw new CajaOcupadaError();
    }
  }

  async obtenerTurnoActivo(idUsuario: string): Promise<TurnoActivoDTO | null> {
    return this.obtenerTurnoActivoUC.ejecutar(idUsuario);
  }

  async listarTurnosActivos(): Promise<TurnoActivoDTO[]> {
    return this.turnoRepo.listarTurnosAbiertos();
  }

  async obtenerTurnoPorId(
    idTurno: string,
    solicitante: { idUsuario: string; rolUsuario: RolUsuario },
  ): Promise<TurnoActivoDTO> {
    return this.obtenerTurnoPorIdUC.ejecutar(idTurno, solicitante);
  }

  async abrirTurno(
    idUsuario: string,
    idCaja: string,
    fondoInicialEfectivo: string,
  ): Promise<TurnoActivoDTO> {
    return this.abrirTurnoUC.ejecutar({
      idUsuario,
      idCaja,
      fondoInicialEfectivo,
    });
  }
}
