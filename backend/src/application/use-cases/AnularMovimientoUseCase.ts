import { randomUUID } from 'node:crypto';
import {
  MovimientoCaja,
  type TipoMovimiento,
} from '../../domain/entities/MovimientoCaja.js';
import {
  MetodoPagoInvalidoError,
  MotivoAnulacionObligatorioError,
  MovimientoNoEncontradoError,
  MovimientoYaAnuladoError,
  RolNoAutorizadoError,
  TurnoNoEncontradoError,
} from '../../domain/errors/DominioError.js';
import { Dinero } from '../../domain/value-objects/Dinero.js';
import type { AnularMovimientoResultadoDTO } from '../dto/MovimientoDTO.js';
import type { MetodoPagoRepositoryPort } from '../ports/out/MetodoPagoRepositoryPort.js';
import type { MovimientoRepositoryPort } from '../ports/out/MovimientoRepositoryPort.js';
import type { TurnoRepositoryPort } from '../ports/out/TurnoRepositoryPort.js';
import type { UsuarioRepositoryPort } from '../ports/out/UsuarioRepositoryPort.js';

export interface ReemplazoMovimientoInput {
  tipoMovimiento?: TipoMovimiento;
  codigoMetodoPago?: string;
  montoOperacion: string;
  conceptoDescripcion?: string | null;
}

export interface AnularMovimientoInput {
  idMovimiento: string;
  idUsuarioEncargado: string;
  motivoAnulacion: string;
  reemplazo?: ReemplazoMovimientoInput | null;
}

/**
 * Caso de uso CU-AnularMovimiento (Issue #4 · RN-01, RN-05, RN-06, RN-08).
 * Permite anular un movimiento erróneo y, opcionalmente en la misma transacción,
 * registrar un movimiento corregido sin alterar los datos históricos del asiento anulado.
 */
export class AnularMovimientoUseCase {
  constructor(
    private readonly turnoRepo: TurnoRepositoryPort,
    private readonly usuarioRepo: UsuarioRepositoryPort,
    private readonly movimientoRepo: MovimientoRepositoryPort,
    private readonly metodoPagoRepo: MetodoPagoRepositoryPort,
  ) {}

  async ejecutar(
    input: AnularMovimientoInput,
  ): Promise<AnularMovimientoResultadoDTO> {
    if (input.motivoAnulacion.trim().length < 3) {
      throw new MotivoAnulacionObligatorioError();
    }

    const codigoMetodoReemplazo = input.reemplazo?.codigoMetodoPago;

    const [usuario, movimiento, metodoReemplazo] = await Promise.all([
      this.usuarioRepo.buscarPorId(input.idUsuarioEncargado),
      this.movimientoRepo.buscarPorId(input.idMovimiento),
      codigoMetodoReemplazo
        ? this.metodoPagoRepo.buscarActivoPorCodigo(codigoMetodoReemplazo)
        : Promise.resolve(null),
    ]);

    if (!usuario || !usuario.estaActivo || !usuario.puedeAnular()) {
      throw new RolNoAutorizadoError(
        'Solo un usuario con rol ENCARGADO puede anular movimientos (RN-08).',
      );
    }

    if (!movimiento) {
      throw new MovimientoNoEncontradoError();
    }

    if (!movimiento.estaActivo()) {
      throw new MovimientoYaAnuladoError();
    }

    const turno = await this.turnoRepo.buscarPorId(movimiento.idTurno);
    if (!turno) {
      throw new TurnoNoEncontradoError();
    }

    // Validar y construir el reemplazo ANTES de mutar el movimiento original (RN-06).
    let movimientoReemplazo: MovimientoCaja | null = null;
    if (input.reemplazo) {
      let idMetodoReemplazo = movimiento.idMetodoPago;
      if (codigoMetodoReemplazo) {
        if (!metodoReemplazo || !metodoReemplazo.estaActivo) {
          throw new MetodoPagoInvalidoError();
        }
        idMetodoReemplazo = metodoReemplazo.idMetodoPago;
      }

      movimientoReemplazo = new MovimientoCaja({
        idMovimiento: randomUUID(),
        idTurno: turno.idTurno,
        idMetodoPago: idMetodoReemplazo,
        idUsuarioRegistro: usuario.idUsuario,
        tipoMovimiento:
          input.reemplazo.tipoMovimiento ?? movimiento.tipoMovimiento,
        montoOperacion: Dinero.desde(input.reemplazo.montoOperacion),
        conceptoDescripcion:
          input.reemplazo.conceptoDescripcion !== undefined
            ? input.reemplazo.conceptoDescripcion
            : movimiento.conceptoDescripcion,
        origenCarga: 'MANUAL',
        urlComprobante: null,
        estadoMovimiento: 'ACTIVO',
        motivoAnulacion: null,
        idUsuarioAnulacion: null,
        fechaHoraAnulacion: null,
        fechaHoraRegistro: new Date(
          Math.max(Date.now(), movimiento.fechaHoraRegistro.getTime() + 1),
        ),
      });
    }

    // Obtener resumen base antes de mutar (en Prisma ya viene pre-cargado; evita doble resta en InMemory).
    const resumenBase = await this.turnoRepo.obtenerResumenTurnoActivo(turno);
    const impactoAnterior = movimiento.obtenerImporteConSigno();

    // Patrón State (RN-05) + Inmutabilidad lógica (RN-01).
    turno.anularMovimiento(movimiento, input.motivoAnulacion, usuario);

    let movAnuladoDTO;
    let movReemplazoDTO = null;

    if (movimientoReemplazo) {
      const resultado = await this.movimientoRepo.anularYReemplazar(
        movimiento,
        movimientoReemplazo,
      );
      movAnuladoDTO = resultado.movimiento;
      movReemplazoDTO = resultado.movimientoReemplazo;
    } else {
      movAnuladoDTO = await this.movimientoRepo.actualizarAnulacion(movimiento);
    }

    // Recalcular en memoria con decimal.js exacto: restar impacto previo y sumar reemplazo si aplica.
    const resumenActualizado = {
      ...resumenBase,
      subtotales_por_metodo: resumenBase.subtotales_por_metodo.map((m) => {
        let saldo = Dinero.desde(m.monto_esperado);
        let cambio = false;

        if (m.id_metodo_pago === movimiento.idMetodoPago) {
          saldo = saldo.restar(impactoAnterior);
          cambio = true;
        }
        if (
          movimientoReemplazo &&
          m.id_metodo_pago === movimientoReemplazo.idMetodoPago
        ) {
          saldo = saldo.sumar(movimientoReemplazo.obtenerImporteConSigno());
          cambio = true;
        }

        return cambio ? { ...m, monto_esperado: saldo.aString() } : m;
      }),
    };

    return {
      movimiento: movAnuladoDTO,
      movimiento_reemplazo: movReemplazoDTO,
      turno: resumenActualizado,
    };
  }
}
