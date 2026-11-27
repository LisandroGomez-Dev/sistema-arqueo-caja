import bcrypt from 'bcryptjs';
import type { MovimientoDTO } from '../../src/application/dto/MovimientoDTO.js';
import type {
  CajaConEstadoDTO,
  ConfiguracionPublicaDTO,
  OperadorPublicoDTO,
  TurnoActivoDTO,
} from '../../src/application/dto/TurnoActivoDTO.js';
import type { CajaRepositoryPort } from '../../src/application/ports/out/CajaRepositoryPort.js';
import type {
  ConfiguracionCajaActual,
  ConfiguracionRepositoryPort,
} from '../../src/application/ports/out/ConfiguracionRepositoryPort.js';
import type { MetodoPagoRepositoryPort } from '../../src/application/ports/out/MetodoPagoRepositoryPort.js';
import type { MovimientoRepositoryPort } from '../../src/application/ports/out/MovimientoRepositoryPort.js';
import type { PinHasherPort } from '../../src/application/ports/out/PinHasherPort.js';
import type { TurnoRepositoryPort } from '../../src/application/ports/out/TurnoRepositoryPort.js';
import type {
  UsuarioConHash,
  UsuarioRepositoryPort,
} from '../../src/application/ports/out/UsuarioRepositoryPort.js';
import { Caja } from '../../src/domain/entities/Caja.js';
import { MetodoPago } from '../../src/domain/entities/MetodoPago.js';
import type { MovimientoCaja } from '../../src/domain/entities/MovimientoCaja.js';
import type { TurnoCaja } from '../../src/domain/entities/TurnoCaja.js';
import { Usuario } from '../../src/domain/entities/Usuario.js';
import {
  CajaNoEncontradaError,
  CajaOcupadaError,
  TurnoYaAbiertoError,
  UsuarioNoEncontradoError,
} from '../../src/domain/errors/DominioError.js';
import { Dinero } from '../../src/domain/value-objects/Dinero.js';

export const TEST_IDS = {
  cajero1: '11111111-1111-4111-8111-111111111111',
  cajero2: '11111111-1111-4111-8111-111111111112',
  encargado: '22222222-2222-4222-8222-222222222222',
  caja1: '55555555-5555-4555-8555-555555555501',
  caja2: '55555555-5555-4555-8555-555555555502',
  caja3: '55555555-5555-4555-8555-555555555503',
  caja4: '55555555-5555-4555-8555-555555555504',
} as const;

export class InMemoryUsuarioRepository implements UsuarioRepositoryPort {
  private readonly registros: Array<{ usuario: Usuario; pinAccesoHash: string }> = [];

  constructor() {
    this.registros.push(
      {
        usuario: new Usuario({
          idUsuario: TEST_IDS.cajero1,
          nombreCompleto: 'Lucas Gómez',
          rolUsuario: 'CAJERO',
          estaActivo: true,
          fechaAlta: new Date('2026-11-27T09:00:00.000Z'),
        }),
        pinAccesoHash: bcrypt.hashSync('1234', 4),
      },
      {
        usuario: new Usuario({
          idUsuario: TEST_IDS.cajero2,
          nombreCompleto: 'Sofía Pérez',
          rolUsuario: 'CAJERO',
          estaActivo: true,
          fechaAlta: new Date('2026-11-27T09:00:00.000Z'),
        }),
        pinAccesoHash: bcrypt.hashSync('4321', 4),
      },
      {
        usuario: new Usuario({
          idUsuario: TEST_IDS.encargado,
          nombreCompleto: 'Martín Ruiz',
          rolUsuario: 'ENCARGADO',
          estaActivo: true,
          fechaAlta: new Date('2026-11-27T09:00:00.000Z'),
        }),
        pinAccesoHash: bcrypt.hashSync('5678', 4),
      },
    );
  }

  async listarActivos(): Promise<OperadorPublicoDTO[]> {
    return this.registros
      .filter((r) => r.usuario.estaActivo)
      .map((r) => ({
        id_usuario: r.usuario.idUsuario,
        nombre_completo: r.usuario.nombreCompleto,
        rol_usuario: r.usuario.rolUsuario,
      }));
  }

  async buscarPorId(idUsuario: string): Promise<Usuario | null> {
    return (
      this.registros.find((r) => r.usuario.idUsuario === idUsuario)?.usuario ??
      null
    );
  }

  async buscarPorIdConHash(idUsuario: string): Promise<UsuarioConHash | null> {
    const found = this.registros.find((r) => r.usuario.idUsuario === idUsuario);
    if (!found) return null;
    return {
      usuario: found.usuario,
      pinAccesoHash: found.pinAccesoHash,
    };
  }
}

export class InMemoryConfiguracionRepository
  implements ConfiguracionRepositoryPort
{
  async obtenerActual(): Promise<ConfiguracionCajaActual | null> {
    return {
      idConfiguracion: '33333333-3333-4333-8333-333333333333',
      nombreComercio: 'Supermercado Mayorista — Sucursal Centro',
      multiploRedondeoEfectivo: Dinero.cero(),
    };
  }
}

export class InMemoryMetodoPagoRepository implements MetodoPagoRepositoryPort {
  readonly metodos: MetodoPago[] = [
    new MetodoPago({
      idMetodoPago: '44444444-4444-4444-8444-444444444441',
      codigoMetodo: 'EFECTIVO',
      nombreMetodo: 'Efectivo',
      permiteRedondeo: true,
      estaActivo: true,
    }),
    new MetodoPago({
      idMetodoPago: '44444444-4444-4444-8444-444444444442',
      codigoMetodo: 'QR_TRANSFERENCIA',
      nombreMetodo: 'QR / Transferencia',
      permiteRedondeo: false,
      estaActivo: true,
    }),
    new MetodoPago({
      idMetodoPago: '44444444-4444-4444-8444-444444444443',
      codigoMetodo: 'TARJETA',
      nombreMetodo: 'Tarjeta Débito / Crédito',
      permiteRedondeo: false,
      estaActivo: true,
    }),
  ];

  async buscarActivoPorCodigo(codigoMetodo: string): Promise<MetodoPago | null> {
    return (
      this.metodos.find(
        (m) =>
          m.estaActivo &&
          m.codigoMetodo.toUpperCase() === codigoMetodo.trim().toUpperCase(),
      ) ?? null
    );
  }

  buscarPorId(idMetodoPago: string): MetodoPago | undefined {
    return this.metodos.find((m) => m.idMetodoPago === idMetodoPago);
  }
}

export class InMemoryMovimientoRepository implements MovimientoRepositoryPort {
  readonly movimientos: MovimientoCaja[] = [];

  constructor(
    private readonly metodoPagoRepo: InMemoryMetodoPagoRepository,
    private readonly usuarioRepo: UsuarioRepositoryPort,
  ) {}

  private async aDTO(m: MovimientoCaja): Promise<MovimientoDTO> {
    const metodo = this.metodoPagoRepo.buscarPorId(m.idMetodoPago)!;
    const usuarioReg = (await this.usuarioRepo.buscarPorId(m.idUsuarioRegistro))!;
    const usuarioAnul = m.idUsuarioAnulacion
      ? await this.usuarioRepo.buscarPorId(m.idUsuarioAnulacion)
      : null;

    return {
      id_movimiento: m.idMovimiento,
      id_turno: m.idTurno,
      tipo_movimiento: m.tipoMovimiento,
      monto_operacion: m.montoOperacion.aString(),
      concepto_descripcion: m.conceptoDescripcion,
      origen_carga: m.origenCarga,
      url_comprobante: m.urlComprobante,
      estado_movimiento: m.estadoMovimiento,
      motivo_anulacion: m.motivoAnulacion,
      fecha_hora_anulacion: m.fechaHoraAnulacion
        ? m.fechaHoraAnulacion.toISOString()
        : null,
      fecha_hora_registro: m.fechaHoraRegistro.toISOString(),
      metodo_pago: {
        id_metodo_pago: metodo.idMetodoPago,
        codigo_metodo: metodo.codigoMetodo,
        nombre_metodo: metodo.nombreMetodo,
      },
      usuario_registro: {
        id_usuario: usuarioReg.idUsuario,
        nombre_completo: usuarioReg.nombreCompleto,
        rol_usuario: usuarioReg.rolUsuario,
      },
      usuario_anulacion: usuarioAnul
        ? {
            id_usuario: usuarioAnul.idUsuario,
            nombre_completo: usuarioAnul.nombreCompleto,
            rol_usuario: usuarioAnul.rolUsuario,
          }
        : null,
    };
  }

  async buscarPorId(idMovimiento: string): Promise<MovimientoCaja | null> {
    return (
      this.movimientos.find((m) => m.idMovimiento === idMovimiento) ?? null
    );
  }

  async guardar(movimiento: MovimientoCaja): Promise<MovimientoDTO> {
    this.movimientos.push(movimiento);
    return this.aDTO(movimiento);
  }

  async actualizarAnulacion(movimiento: MovimientoCaja): Promise<MovimientoDTO> {
    return this.aDTO(movimiento);
  }

  async anularYReemplazar(
    movimientoAnulado: MovimientoCaja,
    movimientoReemplazo: MovimientoCaja,
  ): Promise<{
    movimiento: MovimientoDTO;
    movimientoReemplazo: MovimientoDTO;
  }> {
    this.movimientos.push(movimientoReemplazo);
    const [movimiento, reemplazoDTO] = await Promise.all([
      this.aDTO(movimientoAnulado),
      this.aDTO(movimientoReemplazo),
    ]);
    return { movimiento, movimientoReemplazo: reemplazoDTO };
  }

  async listarPorTurno(idTurno: string): Promise<MovimientoDTO[]> {
    const filtrados = this.movimientos
      .filter((m) => m.idTurno === idTurno)
      .sort(
        (a, b) =>
          b.fechaHoraRegistro.getTime() - a.fechaHoraRegistro.getTime(),
      );
    return Promise.all(filtrados.map((m) => this.aDTO(m)));
  }

  obtenerEntidadesActivasPorTurno(idTurno: string): MovimientoCaja[] {
    return this.movimientos.filter(
      (m) => m.idTurno === idTurno && m.estaActivo(),
    );
  }
}

export class InMemoryCajaRepository implements CajaRepositoryPort {
  private readonly cajas: Caja[] = [
    new Caja({
      idCaja: TEST_IDS.caja1,
      numeroCaja: 1,
      nombreCaja: 'Caja 1 — Línea Principal',
      estaActiva: true,
    }),
    new Caja({
      idCaja: TEST_IDS.caja2,
      numeroCaja: 2,
      nombreCaja: 'Caja 2 — Línea Principal',
      estaActiva: true,
    }),
    new Caja({
      idCaja: TEST_IDS.caja3,
      numeroCaja: 3,
      nombreCaja: 'Caja 3 — Caja Rápida',
      estaActiva: true,
    }),
    new Caja({
      idCaja: TEST_IDS.caja4,
      numeroCaja: 4,
      nombreCaja: 'Caja 4 — Mayorista',
      estaActiva: true,
    }),
  ];

  private turnoRepo?: InMemoryTurnoRepository;

  vincularTurnoRepo(turnoRepo: InMemoryTurnoRepository): void {
    this.turnoRepo = turnoRepo;
  }

  async buscarPorId(idCaja: string): Promise<Caja | null> {
    return this.cajas.find((c) => c.idCaja === idCaja) ?? null;
  }

  async listarActivasConEstado(): Promise<CajaConEstadoDTO[]> {
    const abiertos = this.turnoRepo
      ? await this.turnoRepo.listarTurnosAbiertos()
      : [];

    return this.cajas
      .filter((c) => c.estaActiva)
      .map((c) => {
        const turno = abiertos.find((t) => t.caja.id_caja === c.idCaja);
        return {
          id_caja: c.idCaja,
          numero_caja: c.numeroCaja,
          nombre_caja: c.nombreCaja,
          estado_caja: turno ? 'OCUPADA' : 'LIBRE',
          turno_activo: turno
            ? {
                id_turno: turno.id_turno,
                fecha_hora_apertura: turno.fecha_hora_apertura,
                fondo_inicial_efectivo: turno.fondo_inicial_efectivo,
                usuario_apertura: turno.usuario_apertura,
              }
            : null,
        };
      });
  }
}

export class InMemoryTurnoRepository implements TurnoRepositoryPort {
  readonly turnos: TurnoCaja[] = [];

  constructor(
    private readonly usuarioRepo: UsuarioRepositoryPort,
    private readonly cajaRepo: CajaRepositoryPort,
    private readonly configRepo: ConfiguracionRepositoryPort,
    private readonly metodoPagoRepo: InMemoryMetodoPagoRepository,
    private readonly movimientoRepo: InMemoryMovimientoRepository,
  ) {}

  async buscarPorId(idTurno: string): Promise<TurnoCaja | null> {
    return this.turnos.find((t) => t.idTurno === idTurno) ?? null;
  }

  async buscarTurnoAbiertoPorUsuario(idUsuario: string): Promise<TurnoCaja | null> {
    return (
      this.turnos.find(
        (t) =>
          t.idUsuarioApertura === idUsuario &&
          t.obtenerCodigoEstado() === 'ABIERTO',
      ) ?? null
    );
  }

  async buscarTurnoAbiertoPorCaja(idCaja: string): Promise<TurnoCaja | null> {
    return (
      this.turnos.find(
        (t) => t.idCaja === idCaja && t.obtenerCodigoEstado() === 'ABIERTO',
      ) ?? null
    );
  }

  async listarTurnosAbiertos(): Promise<TurnoActivoDTO[]> {
    const abiertos = this.turnos.filter(
      (t) => t.obtenerCodigoEstado() === 'ABIERTO',
    );
    const resumenes = await Promise.all(
      abiertos.map((t) => this.obtenerResumenTurnoActivo(t)),
    );
    return resumenes.sort((a, b) => a.caja.numero_caja - b.caja.numero_caja);
  }

  async guardarNuevoTurno(turno: TurnoCaja): Promise<TurnoCaja> {
    if (await this.buscarTurnoAbiertoPorUsuario(turno.idUsuarioApertura)) {
      throw new TurnoYaAbiertoError();
    }
    if (await this.buscarTurnoAbiertoPorCaja(turno.idCaja)) {
      throw new CajaOcupadaError();
    }
    this.turnos.push(turno);
    return turno;
  }

  async obtenerResumenTurnoActivo(turno: TurnoCaja): Promise<TurnoActivoDTO> {
    const [usuario, caja, config] = await Promise.all([
      this.usuarioRepo.buscarPorId(turno.idUsuarioApertura),
      this.cajaRepo.buscarPorId(turno.idCaja),
      this.configRepo.obtenerActual(),
    ]);

    if (!usuario) {
      throw new UsuarioNoEncontradoError();
    }
    if (!caja) {
      throw new CajaNoEncontradaError();
    }

    const configuracionPublica: ConfiguracionPublicaDTO = config
      ? {
          nombre_comercio: config.nombreComercio,
          multiplo_redondeo_efectivo: config.multiploRedondeoEfectivo.aString(),
        }
      : {
          nombre_comercio: 'Comercio ArqueoCaja',
          multiplo_redondeo_efectivo: '0.00',
        };

    const movsActivos = this.movimientoRepo.obtenerEntidadesActivasPorTurno(
      turno.idTurno,
    );

    return {
      id_turno: turno.idTurno,
      estado_turno: turno.obtenerCodigoEstado(),
      fondo_inicial_efectivo: turno.fondoInicialEfectivo.aString(),
      fecha_hora_apertura: turno.fechaHoraApertura.toISOString(),
      fecha_hora_cierre: turno.fechaHoraCierre
        ? turno.fechaHoraCierre.toISOString()
        : null,
      caja: {
        id_caja: caja.idCaja,
        numero_caja: caja.numeroCaja,
        nombre_caja: caja.nombreCaja,
      },
      usuario_apertura: {
        id_usuario: usuario.idUsuario,
        nombre_completo: usuario.nombreCompleto,
        rol_usuario: usuario.rolUsuario,
      },
      subtotales_por_metodo: this.metodoPagoRepo.metodos.map((m) => {
        let acumulado = turno.calcularEsperadoInicialPorMetodo(m);
        for (const mov of movsActivos) {
          if (mov.idMetodoPago !== m.idMetodoPago) continue;
          acumulado = acumulado.sumar(mov.obtenerImporteConSigno());
        }
        return {
          id_metodo_pago: m.idMetodoPago,
          codigo_metodo: m.codigoMetodo,
          nombre_metodo: m.nombreMetodo,
          permite_redondeo: m.permiteRedondeo,
          monto_esperado: acumulado.aString(),
        };
      }),
      configuracion: configuracionPublica,
    };
  }
}

export class InMemoryPinHasher implements PinHasherPort {
  async verificar(pinPlano: string, hash: string): Promise<boolean> {
    return bcrypt.compare(pinPlano, hash);
  }
}

export function crearContextoEnMemoria() {
  const usuarioRepo = new InMemoryUsuarioRepository();
  const configRepo = new InMemoryConfiguracionRepository();
  const cajaRepo = new InMemoryCajaRepository();
  const metodoPagoRepo = new InMemoryMetodoPagoRepository();
  const movimientoRepo = new InMemoryMovimientoRepository(
    metodoPagoRepo,
    usuarioRepo,
  );
  const turnoRepo = new InMemoryTurnoRepository(
    usuarioRepo,
    cajaRepo,
    configRepo,
    metodoPagoRepo,
    movimientoRepo,
  );
  cajaRepo.vincularTurnoRepo(turnoRepo);
  const pinHasher = new InMemoryPinHasher();

  return {
    usuarioRepo,
    configRepo,
    cajaRepo,
    metodoPagoRepo,
    movimientoRepo,
    turnoRepo,
    pinHasher,
  };
}
