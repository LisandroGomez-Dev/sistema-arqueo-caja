import type {
  EstadoMovimiento,
  OrigenCarga,
  TipoMovimiento,
} from '../../domain/entities/MovimientoCaja.js';
import type { OperadorPublicoDTO, TurnoActivoDTO } from './TurnoActivoDTO.js';

export interface MetodoPagoResumenDTO {
  id_metodo_pago: string;
  codigo_metodo: string;
  nombre_metodo: string;
}

export interface MovimientoDTO {
  id_movimiento: string;
  id_turno: string;
  tipo_movimiento: TipoMovimiento;
  monto_operacion: string;
  concepto_descripcion: string | null;
  origen_carga: OrigenCarga;
  url_comprobante: string | null;
  estado_movimiento: EstadoMovimiento;
  motivo_anulacion: string | null;
  fecha_hora_anulacion: string | null;
  fecha_hora_registro: string;
  metodo_pago: MetodoPagoResumenDTO;
  usuario_registro: OperadorPublicoDTO;
  usuario_anulacion: OperadorPublicoDTO | null;
}

export interface RegistrarMovimientoResultadoDTO {
  movimiento: MovimientoDTO;
  turno: TurnoActivoDTO;
}

export interface AnularMovimientoResultadoDTO {
  movimiento: MovimientoDTO;
  movimiento_reemplazo: MovimientoDTO | null;
  turno: TurnoActivoDTO;
}
