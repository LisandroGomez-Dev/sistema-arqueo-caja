import {
  EstadoTurno as PrismaEstadoTurno,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import type {
  ArqueoCierreDTO,
  DetalleArqueoMetodoDTO,
} from '../../application/dto/ArqueoDTO.js';
import type { OperadorPublicoDTO } from '../../application/dto/TurnoActivoDTO.js';
import type {
  ArqueoRepositoryPort,
  FiltroListarArqueos,
} from '../../application/ports/out/ArqueoRepositoryPort.js';
import {
  ArqueoCierre,
  evaluarResultadoArqueo,
} from '../../domain/entities/ArqueoCierre.js';
import type { TurnoCaja } from '../../domain/entities/TurnoCaja.js';
import { TurnoCerradoError } from '../../domain/errors/DominioError.js';
import { Dinero } from '../../domain/value-objects/Dinero.js';
import type { CatalogoCache, CatalogoSnapshot } from './CatalogoCache.js';

export class PrismaArqueoRepository implements ArqueoRepositoryPort {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly catalogo: CatalogoCache,
  ) {}

  private operadorDTO(
    idUsuario: string,
    snap: CatalogoSnapshot,
  ): OperadorPublicoDTO {
    const u = snap.usuariosPorId.get(idUsuario);
    return {
      id_usuario: idUsuario,
      nombre_completo: u?.nombreCompleto ?? 'Operador',
      rol_usuario: u?.rolUsuario ?? 'CAJERO',
    };
  }

  private ordenarDetalles(
    detalles: DetalleArqueoMetodoDTO[],
  ): DetalleArqueoMetodoDTO[] {
    return [...detalles].sort((a, b) => {
      if (a.codigo_metodo === 'EFECTIVO' && b.codigo_metodo !== 'EFECTIVO') {
        return -1;
      }
      if (a.codigo_metodo !== 'EFECTIVO' && b.codigo_metodo === 'EFECTIVO') {
        return 1;
      }
      return a.codigo_metodo.localeCompare(b.codigo_metodo);
    });
  }

  /**
   * Transacción atómica de cierre (RN-05, RN-07):
   * bloquea el turno cambiando estado_turno = 'CERRADO' solo si estaba 'ABIERTO',
   * e inserta arqueos_cierre + detalle_arqueo_metodo en la misma unidad de trabajo.
   */
  async guardarCierreAtomico(
    turnoCerrado: TurnoCaja,
    arqueo: ArqueoCierre,
  ): Promise<ArqueoCierreDTO> {
    const fechaCierre = turnoCerrado.fechaHoraCierre ?? arqueo.fechaHoraCierre;

    const [, snap] = await Promise.all([
      this.prisma.$transaction(async (tx) => {
        const updated = await tx.turnoCaja.updateMany({
          where: {
            id_turno: turnoCerrado.idTurno,
            estado_turno: PrismaEstadoTurno.ABIERTO,
          },
          data: {
            estado_turno: PrismaEstadoTurno.CERRADO,
            fecha_hora_cierre: fechaCierre,
          },
        });

        if (updated.count === 0) {
          throw new TurnoCerradoError();
        }

        await tx.arqueoCierre.create({
          data: {
            id_arqueo: arqueo.idArqueo,
            id_turno: arqueo.idTurno,
            id_usuario_cierre: arqueo.idUsuarioCierre,
            multiplo_redondeo_aplicado:
              arqueo.multiploRedondeoAplicado.aString(),
            total_esperado_general: arqueo.totalEsperadoGeneral.aString(),
            total_declarado_general: arqueo.totalDeclaradoGeneral.aString(),
            ajuste_redondeo_total: arqueo.ajusteRedondeoTotal.aString(),
            diferencia_real_total: arqueo.diferenciaRealTotal.aString(),
            observaciones_cierre: arqueo.observacionesCierre,
            fecha_hora_cierre: arqueo.fechaHoraCierre,
            detalles: {
              create: arqueo.detalles.map((d) => ({
                id_detalle_arqueo: d.idDetalleArqueo,
                id_metodo_pago: d.metodoPago.idMetodoPago,
                monto_esperado: d.montoEsperado.aString(),
                monto_declarado: d.montoDeclarado.aString(),
                ajuste_redondeo: d.ajusteRedondeo.aString(),
                diferencia_real: d.diferenciaReal.aString(),
              })),
            },
          },
        });
      }),
      this.catalogo.obtener(),
    ]);

    const caja = snap.cajasResumenPorId.get(turnoCerrado.idCaja) ?? {
      id_caja: turnoCerrado.idCaja,
      numero_caja: 0,
      nombre_caja: 'Caja',
    };

    const detallesDTO: DetalleArqueoMetodoDTO[] = arqueo.detalles.map((d) => ({
      id_detalle_arqueo: d.idDetalleArqueo,
      id_metodo_pago: d.metodoPago.idMetodoPago,
      codigo_metodo: d.metodoPago.codigoMetodo,
      nombre_metodo: d.metodoPago.nombreMetodo,
      permite_redondeo: d.metodoPago.permiteRedondeo,
      monto_esperado: d.montoEsperado.aString(),
      monto_declarado: d.montoDeclarado.aString(),
      ajuste_redondeo: d.ajusteRedondeo.aString(),
      diferencia_real: d.diferenciaReal.aString(),
    }));

    return {
      id_arqueo: arqueo.idArqueo,
      id_turno: arqueo.idTurno,
      nombre_comercio:
        snap.configuracion?.nombreComercio ?? 'Comercio ArqueoCaja',
      caja,
      usuario_apertura: this.operadorDTO(turnoCerrado.idUsuarioApertura, snap),
      usuario_cierre: this.operadorDTO(arqueo.idUsuarioCierre, snap),
      fondo_inicial_efectivo: turnoCerrado.fondoInicialEfectivo.aString(),
      fecha_hora_apertura: turnoCerrado.fechaHoraApertura.toISOString(),
      fecha_hora_cierre: fechaCierre.toISOString(),
      multiplo_redondeo_aplicado: arqueo.multiploRedondeoAplicado.aString(),
      total_esperado_general: arqueo.totalEsperadoGeneral.aString(),
      total_declarado_general: arqueo.totalDeclaradoGeneral.aString(),
      ajuste_redondeo_total: arqueo.ajusteRedondeoTotal.aString(),
      diferencia_real_total: arqueo.diferenciaRealTotal.aString(),
      estado_resultado: arqueo.obtenerEstadoResultado(),
      alerta_posible_reclamo_cliente:
        arqueo.requiereAlertaPosibleReclamoCliente(),
      observaciones_cierre: arqueo.observacionesCierre,
      detalles: this.ordenarDetalles(detallesDTO),
    };
  }

  private mapearRowADTO(
    row: Prisma.ArqueoCierreGetPayload<{
      include: { detalles: true; turno: true };
    }>,
    snap: CatalogoSnapshot,
  ): ArqueoCierreDTO {
    const multiploAplicado = Dinero.desde(
      row.multiplo_redondeo_aplicado.toString(),
    );
    const ajusteTotal = Dinero.desde(row.ajuste_redondeo_total.toString());
    const diferenciaTotal = Dinero.desde(row.diferencia_real_total.toString());
    const evaluacion = evaluarResultadoArqueo(
      ajusteTotal,
      diferenciaTotal,
      multiploAplicado,
    );

    const caja = snap.cajasResumenPorId.get(row.turno.id_caja) ?? {
      id_caja: row.turno.id_caja,
      numero_caja: 0,
      nombre_caja: 'Caja',
    };

    const detallesDTO: DetalleArqueoMetodoDTO[] = row.detalles.map((d) => {
      const metodo = snap.metodosPorId.get(d.id_metodo_pago);
      return {
        id_detalle_arqueo: d.id_detalle_arqueo,
        id_metodo_pago: d.id_metodo_pago,
        codigo_metodo: metodo?.codigoMetodo ?? 'EFECTIVO',
        nombre_metodo: metodo?.nombreMetodo ?? 'Efectivo',
        permite_redondeo: metodo?.permiteRedondeo ?? false,
        monto_esperado: Dinero.desde(d.monto_esperado.toString()).aString(),
        monto_declarado: Dinero.desde(d.monto_declarado.toString()).aString(),
        ajuste_redondeo: Dinero.desde(d.ajuste_redondeo.toString()).aString(),
        diferencia_real: Dinero.desde(d.diferencia_real.toString()).aString(),
      };
    });

    return {
      id_arqueo: row.id_arqueo,
      id_turno: row.id_turno,
      nombre_comercio:
        snap.configuracion?.nombreComercio ?? 'Comercio ArqueoCaja',
      caja,
      usuario_apertura: this.operadorDTO(row.turno.id_usuario_apertura, snap),
      usuario_cierre: this.operadorDTO(row.id_usuario_cierre, snap),
      fondo_inicial_efectivo: Dinero.desde(
        row.turno.fondo_inicial_efectivo.toString(),
      ).aString(),
      fecha_hora_apertura: row.turno.fecha_hora_apertura.toISOString(),
      fecha_hora_cierre: row.fecha_hora_cierre.toISOString(),
      multiplo_redondeo_aplicado: multiploAplicado.aString(),
      total_esperado_general: Dinero.desde(
        row.total_esperado_general.toString(),
      ).aString(),
      total_declarado_general: Dinero.desde(
        row.total_declarado_general.toString(),
      ).aString(),
      ajuste_redondeo_total: ajusteTotal.aString(),
      diferencia_real_total: diferenciaTotal.aString(),
      estado_resultado: evaluacion.estadoResultado,
      alerta_posible_reclamo_cliente: evaluacion.alertaPosibleReclamoCliente,
      observaciones_cierre: row.observaciones_cierre,
      detalles: this.ordenarDetalles(detallesDTO),
    };
  }

  async buscarPorId(idArqueo: string): Promise<ArqueoCierreDTO | null> {
    const [row, snap] = await Promise.all([
      this.prisma.arqueoCierre.findUnique({
        where: { id_arqueo: idArqueo },
        include: {
          detalles: true,
          turno: true,
        },
      }),
      this.catalogo.obtener(),
    ]);

    return row ? this.mapearRowADTO(row, snap) : null;
  }

  async listar(filtro: FiltroListarArqueos): Promise<ArqueoCierreDTO[]> {
    const where: Prisma.ArqueoCierreWhereInput = {};

    if (filtro.fechaDesde || filtro.fechaHasta) {
      where.fecha_hora_cierre = {
        ...(filtro.fechaDesde ? { gte: filtro.fechaDesde } : {}),
        ...(filtro.fechaHasta ? { lte: filtro.fechaHasta } : {}),
      };
    }

    if (filtro.idUsuarioOperador || filtro.idCaja) {
      where.turno = {
        ...(filtro.idUsuarioOperador
          ? { id_usuario_apertura: filtro.idUsuarioOperador }
          : {}),
        ...(filtro.idCaja ? { id_caja: filtro.idCaja } : {}),
      };
    }

    const [rows, snap] = await Promise.all([
      this.prisma.arqueoCierre.findMany({
        where,
        include: {
          detalles: true,
          turno: true,
        },
        orderBy: { fecha_hora_cierre: 'desc' },
      }),
      this.catalogo.obtener(),
    ]);

    return rows.map((row) => this.mapearRowADTO(row, snap));
  }
}
