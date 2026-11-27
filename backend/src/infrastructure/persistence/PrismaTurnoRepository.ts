import {
  EstadoMovimiento,
  EstadoTurno as PrismaEstadoTurno,
  Prisma,
  TipoMovimiento,
  type PrismaClient,
} from '@prisma/client';
import type {
  SubtotalMetodoDTO,
  TurnoActivoDTO,
} from '../../application/dto/TurnoActivoDTO.js';
import type { TurnoRepositoryPort } from '../../application/ports/out/TurnoRepositoryPort.js';
import { TurnoCaja } from '../../domain/entities/TurnoCaja.js';
import {
  CajaNoEncontradaError,
  CajaOcupadaError,
  TurnoYaAbiertoError,
  UsuarioNoEncontradoError,
} from '../../domain/errors/DominioError.js';
import { EstadoTurnoAbierto } from '../../domain/state/EstadoTurnoAbierto.js';
import { EstadoTurnoCerrado } from '../../domain/state/EstadoTurnoCerrado.js';
import { Dinero } from '../../domain/value-objects/Dinero.js';
import type { CatalogoCache, CatalogoSnapshot } from './CatalogoCache.js';

interface MovimientoResumenRow {
  id_turno: string;
  id_metodo_pago: string;
  tipo_movimiento: TipoMovimiento;
  monto_operacion: Prisma.Decimal;
}

export class PrismaTurnoRepository implements TurnoRepositoryPort {
  private readonly movimientosPreCargados = new WeakMap<
    TurnoCaja,
    MovimientoResumenRow[]
  >();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly catalogo: CatalogoCache,
  ) {}

  private mapearEntidad(row: {
    id_turno: string;
    id_caja: string;
    id_usuario_apertura: string;
    fondo_inicial_efectivo: Prisma.Decimal;
    estado_turno: PrismaEstadoTurno;
    fecha_hora_apertura: Date;
    fecha_hora_cierre: Date | null;
  }): TurnoCaja {
    return new TurnoCaja({
      idTurno: row.id_turno,
      idCaja: row.id_caja,
      idUsuarioApertura: row.id_usuario_apertura,
      fondoInicialEfectivo: Dinero.desde(row.fondo_inicial_efectivo.toString()),
      fechaHoraApertura: row.fecha_hora_apertura,
      fechaHoraCierre: row.fecha_hora_cierre,
      estado:
        row.estado_turno === PrismaEstadoTurno.ABIERTO
          ? new EstadoTurnoAbierto()
          : new EstadoTurnoCerrado(),
    });
  }

  private construirResumenDTO(
    turno: TurnoCaja,
    movimientos: MovimientoResumenRow[],
    snap: CatalogoSnapshot,
  ): TurnoActivoDTO {
    const usuario = snap.usuariosPorId.get(turno.idUsuarioApertura);
    if (!usuario) {
      throw new UsuarioNoEncontradoError();
    }

    const caja = snap.cajasResumenPorId.get(turno.idCaja);
    if (!caja) {
      throw new CajaNoEncontradaError();
    }

    const subtotalesPorMetodo: SubtotalMetodoDTO[] = snap.metodosPago.map(
      (metodoDominio) => {
        let acumulado = turno.calcularEsperadoInicialPorMetodo(metodoDominio);

        for (const mov of movimientos) {
          if (mov.id_metodo_pago !== metodoDominio.idMetodoPago) continue;
          const importe = Dinero.desde(mov.monto_operacion.toString());
          acumulado =
            mov.tipo_movimiento === TipoMovimiento.INGRESO
              ? acumulado.sumar(importe)
              : acumulado.restar(importe);
        }

        return {
          id_metodo_pago: metodoDominio.idMetodoPago,
          codigo_metodo: metodoDominio.codigoMetodo,
          nombre_metodo: metodoDominio.nombreMetodo,
          permite_redondeo: metodoDominio.permiteRedondeo,
          monto_esperado: acumulado.aString(),
        };
      },
    );

    return {
      id_turno: turno.idTurno,
      estado_turno: turno.obtenerCodigoEstado(),
      fondo_inicial_efectivo: turno.fondoInicialEfectivo.aString(),
      fecha_hora_apertura: turno.fechaHoraApertura.toISOString(),
      fecha_hora_cierre: turno.fechaHoraCierre
        ? turno.fechaHoraCierre.toISOString()
        : null,
      caja,
      usuario_apertura: {
        id_usuario: usuario.idUsuario,
        nombre_completo: usuario.nombreCompleto,
        rol_usuario: usuario.rolUsuario,
      },
      subtotales_por_metodo: subtotalesPorMetodo,
      configuracion: snap.configuracion?.publica ?? {
        nombre_comercio: 'Comercio ArqueoCaja',
        multiplo_redondeo_efectivo: '0.00',
      },
    };
  }

  /**
   * 1 sola ronda paralela (turno + movimientos activos sin subqueries secuenciales).
   */
  async buscarPorId(idTurno: string): Promise<TurnoCaja | null> {
    const [row, movimientos] = await Promise.all([
      this.prisma.turnoCaja.findUnique({ where: { id_turno: idTurno } }),
      this.prisma.movimientoCaja.findMany({
        where: {
          id_turno: idTurno,
          estado_movimiento: EstadoMovimiento.ACTIVO,
        },
        select: {
          id_turno: true,
          id_metodo_pago: true,
          tipo_movimiento: true,
          monto_operacion: true,
        },
      }),
    ]);

    if (!row) return null;
    const entidad = this.mapearEntidad(row);
    this.movimientosPreCargados.set(entidad, movimientos);
    return entidad;
  }

  async buscarTurnoAbiertoPorUsuario(idUsuario: string): Promise<TurnoCaja | null> {
    const row = await this.prisma.turnoCaja.findFirst({
      where: {
        id_usuario_apertura: idUsuario,
        estado_turno: PrismaEstadoTurno.ABIERTO,
      },
      orderBy: { fecha_hora_apertura: 'desc' },
    });
    return row ? this.mapearEntidad(row) : null;
  }

  async buscarTurnoAbiertoPorCaja(idCaja: string): Promise<TurnoCaja | null> {
    const row = await this.prisma.turnoCaja.findFirst({
      where: {
        id_caja: idCaja,
        estado_turno: PrismaEstadoTurno.ABIERTO,
      },
      orderBy: { fecha_hora_apertura: 'desc' },
    });
    return row ? this.mapearEntidad(row) : null;
  }

  /**
   * 2 queries planas en paralelo sin N+1 (turnos abiertos + sus movimientos activos).
   */
  async listarTurnosAbiertos(): Promise<TurnoActivoDTO[]> {
    const [snap, rows] = await Promise.all([
      this.catalogo.obtener(),
      this.prisma.turnoCaja.findMany({
        where: { estado_turno: PrismaEstadoTurno.ABIERTO },
      }),
    ]);

    if (rows.length === 0) {
      return [];
    }

    const idsTurnos = rows.map((r) => r.id_turno);
    const movimientos = await this.prisma.movimientoCaja.findMany({
      where: {
        id_turno: { in: idsTurnos },
        estado_movimiento: EstadoMovimiento.ACTIVO,
      },
      select: {
        id_turno: true,
        id_metodo_pago: true,
        tipo_movimiento: true,
        monto_operacion: true,
      },
    });

    const movsPorTurno = new Map<string, MovimientoResumenRow[]>();
    for (const m of movimientos) {
      const lista = movsPorTurno.get(m.id_turno) ?? [];
      lista.push(m);
      movsPorTurno.set(m.id_turno, lista);
    }

    return rows
      .map((row) => {
        const entidad = this.mapearEntidad(row);
        return this.construirResumenDTO(
          entidad,
          movsPorTurno.get(row.id_turno) ?? [],
          snap,
        );
      })
      .sort((a, b) => a.caja.numero_caja - b.caja.numero_caja);
  }

  /**
   * 1 único INSERT SQL: un turno recién abierto tiene 0 movimientos, evita re-leer BD.
   */
  async guardarNuevoTurno(turno: TurnoCaja): Promise<TurnoCaja> {
    try {
      const creado = await this.prisma.turnoCaja.create({
        data: {
          id_turno: turno.idTurno,
          id_caja: turno.idCaja,
          id_usuario_apertura: turno.idUsuarioApertura,
          fondo_inicial_efectivo: turno.fondoInicialEfectivo.aString(),
          estado_turno: PrismaEstadoTurno.ABIERTO,
          fecha_hora_apertura: turno.fechaHoraApertura,
          fecha_hora_cierre: turno.fechaHoraCierre,
        },
      });

      const entidad = this.mapearEntidad(creado);
      this.movimientosPreCargados.set(entidad, []);
      return entidad;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const msg = String(error.message ?? '');
        if (msg.includes('uniq_turno_abierto_por_caja')) {
          throw new CajaOcupadaError();
        }
        throw new TurnoYaAbiertoError();
      }
      throw error;
    }
  }

  async obtenerResumenTurnoActivo(turno: TurnoCaja): Promise<TurnoActivoDTO> {
    const preCargados = this.movimientosPreCargados.get(turno);
    if (preCargados !== undefined) {
      const snap = await this.catalogo.obtener();
      return this.construirResumenDTO(turno, preCargados, snap);
    }

    const [snap, movimientos] = await Promise.all([
      this.catalogo.obtener(),
      this.prisma.movimientoCaja.findMany({
        where: {
          id_turno: turno.idTurno,
          estado_movimiento: EstadoMovimiento.ACTIVO,
        },
        select: {
          id_turno: true,
          id_metodo_pago: true,
          tipo_movimiento: true,
          monto_operacion: true,
        },
      }),
    ]);

    this.movimientosPreCargados.set(turno, movimientos);
    return this.construirResumenDTO(turno, movimientos, snap);
  }
}
