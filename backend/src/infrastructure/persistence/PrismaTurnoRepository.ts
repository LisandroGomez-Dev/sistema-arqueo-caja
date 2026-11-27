import {
  EstadoMovimiento,
  EstadoTurno as PrismaEstadoTurno,
  Prisma,
  TipoMovimiento,
  type PrismaClient,
} from '@prisma/client';
import type {
  ConfiguracionPublicaDTO,
  OperadorPublicoDTO,
  SubtotalMetodoDTO,
  TurnoActivoDTO,
} from '../../application/dto/TurnoActivoDTO.js';
import type { TurnoRepositoryPort } from '../../application/ports/out/TurnoRepositoryPort.js';
import { MetodoPago } from '../../domain/entities/MetodoPago.js';
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

const CATALOGO_TTL_MS = 60_000;

interface TurnoRowConRelaciones {
  id_turno: string;
  id_caja: string;
  id_usuario_apertura: string;
  fondo_inicial_efectivo: Prisma.Decimal;
  estado_turno: PrismaEstadoTurno;
  fecha_hora_apertura: Date;
  fecha_hora_cierre: Date | null;
  usuario_apertura: OperadorPublicoDTO;
  caja: {
    id_caja: string;
    numero_caja: number;
    nombre_caja: string;
  };
  movimientos: Array<{
    id_metodo_pago: string;
    tipo_movimiento: TipoMovimiento;
    monto_operacion: Prisma.Decimal;
  }>;
}

const INCLUDE_TURNO_COMPLETO = {
  usuario_apertura: {
    select: {
      id_usuario: true,
      nombre_completo: true,
      rol_usuario: true,
    },
  },
  caja: {
    select: {
      id_caja: true,
      numero_caja: true,
      nombre_caja: true,
    },
  },
  movimientos: {
    where: { estado_movimiento: EstadoMovimiento.ACTIVO },
    select: {
      id_metodo_pago: true,
      tipo_movimiento: true,
      monto_operacion: true,
    },
  },
} as const;

export class PrismaTurnoRepository implements TurnoRepositoryPort {
  private readonly relacionesCargadas = new WeakMap<TurnoCaja, TurnoRowConRelaciones>();

  private cacheCatalogo: {
    expiraEn: number;
    metodos: MetodoPago[];
    configuracion: ConfiguracionPublicaDTO;
  } | null = null;

  constructor(private readonly prisma: PrismaClient) {}

  private async obtenerCatalogo(): Promise<{
    metodos: MetodoPago[];
    configuracion: ConfiguracionPublicaDTO;
  }> {
    const ahora = Date.now();
    if (this.cacheCatalogo && ahora < this.cacheCatalogo.expiraEn) {
      return {
        metodos: this.cacheCatalogo.metodos,
        configuracion: this.cacheCatalogo.configuracion,
      };
    }

    const [metodosRows, configRow] = await Promise.all([
      this.prisma.metodoPago.findMany({
        where: { esta_activo: true },
        orderBy: { codigo_metodo: 'asc' },
      }),
      this.prisma.configuracionCaja.findFirst({
        orderBy: { fecha_ultima_actualizacion: 'desc' },
      }),
    ]);

    const metodos = metodosRows.map(
      (m) =>
        new MetodoPago({
          idMetodoPago: m.id_metodo_pago,
          codigoMetodo: m.codigo_metodo,
          nombreMetodo: m.nombre_metodo,
          permiteRedondeo: m.permite_redondeo,
          estaActivo: m.esta_activo,
        }),
    );

    const configuracion: ConfiguracionPublicaDTO = {
      nombre_comercio: configRow?.nombre_comercio ?? 'Comercio ArqueoCaja',
      multiplo_redondeo_efectivo: configRow
        ? Dinero.desde(configRow.multiplo_redondeo_efectivo.toString()).aString()
        : '0.00',
    };

    this.cacheCatalogo = {
      expiraEn: ahora + CATALOGO_TTL_MS,
      metodos,
      configuracion,
    };

    return { metodos, configuracion };
  }

  private mapearEntidadConRelaciones(row: TurnoRowConRelaciones): TurnoCaja {
    const entidad = new TurnoCaja({
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
    this.relacionesCargadas.set(entidad, row);
    return entidad;
  }

  private construirResumenDTO(
    turno: TurnoCaja,
    rel: TurnoRowConRelaciones,
    metodos: MetodoPago[],
    configuracion: ConfiguracionPublicaDTO,
  ): TurnoActivoDTO {
    const subtotalesPorMetodo: SubtotalMetodoDTO[] = metodos.map((metodoDominio) => {
      let acumulado = turno.calcularEsperadoInicialPorMetodo(metodoDominio);

      for (const mov of rel.movimientos) {
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
    });

    return {
      id_turno: turno.idTurno,
      estado_turno: turno.obtenerCodigoEstado(),
      fondo_inicial_efectivo: turno.fondoInicialEfectivo.aString(),
      fecha_hora_apertura: turno.fechaHoraApertura.toISOString(),
      fecha_hora_cierre: turno.fechaHoraCierre
        ? turno.fechaHoraCierre.toISOString()
        : null,
      caja: rel.caja,
      usuario_apertura: rel.usuario_apertura,
      subtotales_por_metodo: subtotalesPorMetodo,
      configuracion,
    };
  }

  async buscarPorId(idTurno: string): Promise<TurnoCaja | null> {
    const row = await this.prisma.turnoCaja.findUnique({
      where: { id_turno: idTurno },
      include: INCLUDE_TURNO_COMPLETO,
    });
    return row ? this.mapearEntidadConRelaciones(row) : null;
  }

  async buscarTurnoAbiertoPorUsuario(idUsuario: string): Promise<TurnoCaja | null> {
    const row = await this.prisma.turnoCaja.findFirst({
      where: {
        id_usuario_apertura: idUsuario,
        estado_turno: PrismaEstadoTurno.ABIERTO,
      },
      orderBy: { fecha_hora_apertura: 'desc' },
      include: INCLUDE_TURNO_COMPLETO,
    });
    return row ? this.mapearEntidadConRelaciones(row) : null;
  }

  async buscarTurnoAbiertoPorCaja(idCaja: string): Promise<TurnoCaja | null> {
    const row = await this.prisma.turnoCaja.findFirst({
      where: {
        id_caja: idCaja,
        estado_turno: PrismaEstadoTurno.ABIERTO,
      },
      orderBy: { fecha_hora_apertura: 'desc' },
      include: INCLUDE_TURNO_COMPLETO,
    });
    return row ? this.mapearEntidadConRelaciones(row) : null;
  }

  async listarTurnosAbiertos(): Promise<TurnoActivoDTO[]> {
    const [rows, catalogo] = await Promise.all([
      this.prisma.turnoCaja.findMany({
        where: { estado_turno: PrismaEstadoTurno.ABIERTO },
        orderBy: { caja: { numero_caja: 'asc' } },
        include: INCLUDE_TURNO_COMPLETO,
      }),
      this.obtenerCatalogo(),
    ]);

    return rows.map((row) => {
      const entidad = this.mapearEntidadConRelaciones(row);
      return this.construirResumenDTO(
        entidad,
        row,
        catalogo.metodos,
        catalogo.configuracion,
      );
    });
  }

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
        include: INCLUDE_TURNO_COMPLETO,
      });

      return this.mapearEntidadConRelaciones(creado);
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
    const cachedRel = this.relacionesCargadas.get(turno);
    if (cachedRel) {
      const catalogo = await this.obtenerCatalogo();
      return this.construirResumenDTO(
        turno,
        cachedRel,
        catalogo.metodos,
        catalogo.configuracion,
      );
    }

    const [row, catalogo] = await Promise.all([
      this.prisma.turnoCaja.findUnique({
        where: { id_turno: turno.idTurno },
        include: INCLUDE_TURNO_COMPLETO,
      }),
      this.obtenerCatalogo(),
    ]);

    if (!row) {
      throw new CajaNoEncontradaError('No se encontró el detalle del turno.');
    }
    if (!row.usuario_apertura) {
      throw new UsuarioNoEncontradoError();
    }

    this.relacionesCargadas.set(turno, row);
    return this.construirResumenDTO(
      turno,
      row,
      catalogo.metodos,
      catalogo.configuracion,
    );
  }
}
