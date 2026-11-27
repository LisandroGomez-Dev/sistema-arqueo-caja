import type { PrismaClient } from '@prisma/client';
import type { MovimientoDTO } from '../../application/dto/MovimientoDTO.js';
import type { MovimientoRepositoryPort } from '../../application/ports/out/MovimientoRepositoryPort.js';
import type { MovimientoCaja } from '../../domain/entities/MovimientoCaja.js';
import { Dinero } from '../../domain/value-objects/Dinero.js';
import type { CatalogoCache, CatalogoSnapshot } from './CatalogoCache.js';

export class PrismaMovimientoRepository implements MovimientoRepositoryPort {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly catalogo: CatalogoCache,
  ) {}

  private mapearDTO(
    row: {
      id_movimiento: string;
      id_turno: string;
      id_metodo_pago: string;
      id_usuario_registro: string;
      tipo_movimiento: 'INGRESO' | 'EGRESO';
      monto_operacion: { toString(): string };
      concepto_descripcion: string | null;
      origen_carga: 'MANUAL' | 'IA_VOZ_TEXTO' | 'IA_COMPROBANTE';
      url_comprobante: string | null;
      estado_movimiento: 'ACTIVO' | 'ANULADO';
      motivo_anulacion: string | null;
      id_usuario_anulacion: string | null;
      fecha_hora_anulacion: Date | null;
      fecha_hora_registro: Date;
    },
    snap: CatalogoSnapshot,
  ): MovimientoDTO {
    const metodo = snap.metodosPorId.get(row.id_metodo_pago);
    const usuarioReg = snap.usuariosPorId.get(row.id_usuario_registro);
    const usuarioAnul = row.id_usuario_anulacion
      ? snap.usuariosPorId.get(row.id_usuario_anulacion)
      : undefined;

    return {
      id_movimiento: row.id_movimiento,
      id_turno: row.id_turno,
      tipo_movimiento: row.tipo_movimiento,
      monto_operacion: Dinero.desde(row.monto_operacion.toString()).aString(),
      concepto_descripcion: row.concepto_descripcion,
      origen_carga: row.origen_carga,
      url_comprobante: row.url_comprobante,
      estado_movimiento: row.estado_movimiento,
      motivo_anulacion: row.motivo_anulacion,
      fecha_hora_anulacion: row.fecha_hora_anulacion
        ? row.fecha_hora_anulacion.toISOString()
        : null,
      fecha_hora_registro: row.fecha_hora_registro.toISOString(),
      metodo_pago: {
        id_metodo_pago: row.id_metodo_pago,
        codigo_metodo: metodo?.codigoMetodo ?? 'EFECTIVO',
        nombre_metodo: metodo?.nombreMetodo ?? 'Efectivo',
      },
      usuario_registro: {
        id_usuario: row.id_usuario_registro,
        nombre_completo: usuarioReg?.nombreCompleto ?? 'Operador',
        rol_usuario: usuarioReg?.rolUsuario ?? 'CAJERO',
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

  /**
   * 1 único INSERT SQL sin `include`: hidrata método y usuario desde CatalogoCache (0 consultas extra).
   */
  async guardar(movimiento: MovimientoCaja): Promise<MovimientoDTO> {
    const [creado, snap] = await Promise.all([
      this.prisma.movimientoCaja.create({
        data: {
          id_movimiento: movimiento.idMovimiento,
          id_turno: movimiento.idTurno,
          id_metodo_pago: movimiento.idMetodoPago,
          id_usuario_registro: movimiento.idUsuarioRegistro,
          tipo_movimiento: movimiento.tipoMovimiento,
          monto_operacion: movimiento.montoOperacion.aString(),
          concepto_descripcion: movimiento.conceptoDescripcion,
          origen_carga: movimiento.origenCarga,
          url_comprobante: movimiento.urlComprobante,
          estado_movimiento: movimiento.estadoMovimiento,
          motivo_anulacion: movimiento.motivoAnulacion,
          id_usuario_anulacion: movimiento.idUsuarioAnulacion,
          fecha_hora_anulacion: movimiento.fechaHoraAnulacion,
          fecha_hora_registro: movimiento.fechaHoraRegistro,
        },
      }),
      this.catalogo.obtener(),
    ]);

    return this.mapearDTO(creado, snap);
  }

  /**
   * 1 única consulta SELECT ordenada por fecha descendente sin subqueries de `include`.
   */
  async listarPorTurno(idTurno: string): Promise<MovimientoDTO[]> {
    const [rows, snap] = await Promise.all([
      this.prisma.movimientoCaja.findMany({
        where: { id_turno: idTurno },
        orderBy: { fecha_hora_registro: 'desc' },
      }),
      this.catalogo.obtener(),
    ]);

    return rows.map((row) => this.mapearDTO(row, snap));
  }
}
