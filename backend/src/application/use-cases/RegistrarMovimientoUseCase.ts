import { randomUUID } from 'node:crypto';
import {
  MovimientoCaja,
  type OrigenCarga,
  type TipoMovimiento,
} from '../../domain/entities/MovimientoCaja.js';
import type { RolUsuario } from '../../domain/entities/Usuario.js';
import {
  MetodoPagoInvalidoError,
  RolNoAutorizadoError,
  TurnoNoEncontradoError,
} from '../../domain/errors/DominioError.js';
import { Dinero } from '../../domain/value-objects/Dinero.js';
import type { RegistrarMovimientoResultadoDTO } from '../dto/MovimientoDTO.js';
import type { MetodoPagoRepositoryPort } from '../ports/out/MetodoPagoRepositoryPort.js';
import type { MovimientoRepositoryPort } from '../ports/out/MovimientoRepositoryPort.js';
import type { TurnoRepositoryPort } from '../ports/out/TurnoRepositoryPort.js';

export interface RegistrarMovimientoInput {
  idTurno: string;
  idUsuario: string;
  rolUsuario: RolUsuario;
  codigoMetodoPago: string;
  tipoMovimiento: TipoMovimiento;
  montoOperacion: string;
  conceptoDescripcion: string | null;
  origenCarga: OrigenCarga;
  urlComprobante?: string | null;
}

/**
 * Caso de uso CU-RegistrarMovimiento (Issue #3 · RN-02, RN-05, RN-06, RN-08, RN-09).
 */
export class RegistrarMovimientoUseCase {
  constructor(
    private readonly turnoRepo: TurnoRepositoryPort,
    private readonly metodoPagoRepo: MetodoPagoRepositoryPort,
    private readonly movimientoRepo: MovimientoRepositoryPort,
  ) {}

  async ejecutar(
    input: RegistrarMovimientoInput,
  ): Promise<RegistrarMovimientoResultadoDTO> {
    // Validar importe y concepto obligatorio en dominio antes de consultar la BD (RN-06).
    const importe = Dinero.desde(input.montoOperacion);
    new MovimientoCaja({
      idMovimiento: 'validacion',
      idTurno: input.idTurno,
      idMetodoPago: 'validacion',
      idUsuarioRegistro: input.idUsuario,
      tipoMovimiento: input.tipoMovimiento,
      montoOperacion: importe,
      conceptoDescripcion: input.conceptoDescripcion,
      origenCarga: input.origenCarga,
      urlComprobante: input.urlComprobante ?? null,
      estadoMovimiento: 'ACTIVO',
      motivoAnulacion: null,
      idUsuarioAnulacion: null,
      fechaHoraAnulacion: null,
      fechaHoraRegistro: new Date(),
    });

    const [turno, metodoPago] = await Promise.all([
      this.turnoRepo.buscarPorId(input.idTurno),
      this.metodoPagoRepo.buscarActivoPorCodigo(input.codigoMetodoPago),
    ]);

    if (!turno) {
      throw new TurnoNoEncontradoError();
    }

    // Patrón State (RN-05): rechaza movimientos sobre un turno cerrado.
    turno.validarOperacion();

    // Multi-Caja + RN-08: un CAJERO solo puede cargar en su propio turno.
    if (
      input.rolUsuario !== 'ENCARGADO' &&
      turno.idUsuarioApertura !== input.idUsuario
    ) {
      throw new RolNoAutorizadoError(
        'Solo podés registrar movimientos en tu propia caja activa (RN-08).',
      );
    }

    if (!metodoPago || !metodoPago.estaActivo) {
      throw new MetodoPagoInvalidoError();
    }

    const nuevoMovimiento = new MovimientoCaja({
      idMovimiento: randomUUID(),
      idTurno: turno.idTurno,
      idMetodoPago: metodoPago.idMetodoPago,
      idUsuarioRegistro: input.idUsuario,
      tipoMovimiento: input.tipoMovimiento,
      montoOperacion: importe,
      conceptoDescripcion: input.conceptoDescripcion,
      origenCarga: input.origenCarga,
      urlComprobante: input.urlComprobante ?? null,
      estadoMovimiento: 'ACTIVO',
      motivoAnulacion: null,
      idUsuarioAnulacion: null,
      fechaHoraAnulacion: null,
      fechaHoraRegistro: new Date(),
    });

    // Obtener resumen base antes de guardar (en Prisma ya viene pre-cargado en memoria: 0 consultas extra).
    const resumenBase = await this.turnoRepo.obtenerResumenTurnoActivo(turno);
    const movimientoGuardado = await this.movimientoRepo.guardar(nuevoMovimiento);

    // Actualizar en memoria con aritmética decimal.js exacta (0 rondas extra a Postgres).
    const delta = nuevoMovimiento.obtenerImporteConSigno();
    const resumenActualizado = {
      ...resumenBase,
      subtotales_por_metodo: resumenBase.subtotales_por_metodo.map((m) =>
        m.id_metodo_pago === metodoPago.idMetodoPago
          ? {
              ...m,
              monto_esperado: Dinero.desde(m.monto_esperado)
                .sumar(delta)
                .aString(),
            }
          : m,
      ),
    };

    return {
      movimiento: movimientoGuardado,
      turno: resumenActualizado,
    };
  }
}
