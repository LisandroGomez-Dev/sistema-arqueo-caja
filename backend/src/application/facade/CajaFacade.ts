import type { RolUsuario } from '../../domain/entities/Usuario.js';
import {
  CajaOcupadaError,
  TurnoYaAbiertoError,
} from '../../domain/errors/DominioError.js';
import type {
  AnularMovimientoResultadoDTO,
  MovimientoDTO,
  RegistrarMovimientoResultadoDTO,
} from '../dto/MovimientoDTO.js';
import type {
  CajaConEstadoDTO,
  ConfiguracionPublicaDTO,
  OperadorPublicoDTO,
  TurnoActivoDTO,
} from '../dto/TurnoActivoDTO.js';
import type { CajaRepositoryPort } from '../ports/out/CajaRepositoryPort.js';
import type { ConfiguracionRepositoryPort } from '../ports/out/ConfiguracionRepositoryPort.js';
import type { MetodoPagoRepositoryPort } from '../ports/out/MetodoPagoRepositoryPort.js';
import type { MovimientoRepositoryPort } from '../ports/out/MovimientoRepositoryPort.js';
import type { PinHasherPort } from '../ports/out/PinHasherPort.js';
import type { TurnoRepositoryPort } from '../ports/out/TurnoRepositoryPort.js';
import type { UsuarioRepositoryPort } from '../ports/out/UsuarioRepositoryPort.js';
import { AbrirTurnoUseCase } from '../use-cases/AbrirTurnoUseCase.js';
import {
  AnularMovimientoUseCase,
  type AnularMovimientoInput,
} from '../use-cases/AnularMovimientoUseCase.js';
import { AutenticarUsuarioUseCase } from '../use-cases/AutenticarUsuarioUseCase.js';
import { ListarMovimientosTurnoUseCase } from '../use-cases/ListarMovimientosTurnoUseCase.js';
import { ObtenerTurnoActivoUseCase } from '../use-cases/ObtenerTurnoActivoUseCase.js';
import { ObtenerTurnoPorIdUseCase } from '../use-cases/ObtenerTurnoPorIdUseCase.js';
import {
  RegistrarMovimientoUseCase,
  type RegistrarMovimientoInput,
} from '../use-cases/RegistrarMovimientoUseCase.js';

export interface CajaFacadeDependencies {
  turnoRepo: TurnoRepositoryPort;
  usuarioRepo: UsuarioRepositoryPort;
  cajaRepo: CajaRepositoryPort;
  configRepo: ConfiguracionRepositoryPort;
  metodoPagoRepo: MetodoPagoRepositoryPort;
  movimientoRepo: MovimientoRepositoryPort;
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
  private readonly registrarMovimientoUC: RegistrarMovimientoUseCase;
  private readonly listarMovimientosTurnoUC: ListarMovimientosTurnoUseCase;
  private readonly anularMovimientoUC: AnularMovimientoUseCase;

  constructor(deps: CajaFacadeDependencies) {
    this.turnoRepo = deps.turnoRepo;
    this.usuarioRepo = deps.usuarioRepo;
    this.cajaRepo = deps.cajaRepo;
    this.configRepo = deps.configRepo;
    this.autenticarUsuarioUC = new AutenticarUsuarioUseCase(deps.usuarioRepo, deps.pinHasher);
    this.abrirTurnoUC = new AbrirTurnoUseCase(deps.turnoRepo, deps.usuarioRepo, deps.cajaRepo);
    this.obtenerTurnoActivoUC = new ObtenerTurnoActivoUseCase(deps.turnoRepo);
    this.obtenerTurnoPorIdUC = new ObtenerTurnoPorIdUseCase(deps.turnoRepo);
    this.registrarMovimientoUC = new RegistrarMovimientoUseCase(
      deps.turnoRepo,
      deps.metodoPagoRepo,
      deps.movimientoRepo,
    );
    this.listarMovimientosTurnoUC = new ListarMovimientosTurnoUseCase(
      deps.turnoRepo,
      deps.movimientoRepo,
    );
    this.anularMovimientoUC = new AnularMovimientoUseCase(
      deps.turnoRepo,
      deps.usuarioRepo,
      deps.movimientoRepo,
      deps.metodoPagoRepo,
    );
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

  async registrarMovimiento(
    input: RegistrarMovimientoInput,
  ): Promise<RegistrarMovimientoResultadoDTO> {
    return this.registrarMovimientoUC.ejecutar(input);
  }

  async listarMovimientosTurno(
    idTurno: string,
    solicitante: { idUsuario: string; rolUsuario: RolUsuario },
  ): Promise<MovimientoDTO[]> {
    return this.listarMovimientosTurnoUC.ejecutar(idTurno, solicitante);
  }

  async anularMovimiento(
    input: AnularMovimientoInput,
  ): Promise<AnularMovimientoResultadoDTO> {
    return this.anularMovimientoUC.ejecutar(input);
  }
}
