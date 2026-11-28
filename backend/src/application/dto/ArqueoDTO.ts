import type { EstadoResultadoArqueo } from '../../domain/entities/ArqueoCierre.js';
import type { CajaResumenDTO, OperadorPublicoDTO } from './TurnoActivoDTO.js';

export interface DetalleArqueoMetodoDTO {
  id_detalle_arqueo: string;
  id_metodo_pago: string;
  codigo_metodo: string;
  nombre_metodo: string;
  permite_redondeo: boolean;
  monto_esperado: string;
  monto_declarado: string;
  ajuste_redondeo: string;
  diferencia_real: string;
}

export interface ArqueoCierreDTO {
  id_arqueo: string;
  id_turno: string;
  nombre_comercio: string;
  caja: CajaResumenDTO;
  usuario_apertura: OperadorPublicoDTO;
  usuario_cierre: OperadorPublicoDTO;
  fondo_inicial_efectivo: string;
  fecha_hora_apertura: string;
  fecha_hora_cierre: string;
  multiplo_redondeo_aplicado: string;
  total_esperado_general: string;
  total_declarado_general: string;
  ajuste_redondeo_total: string;
  diferencia_real_total: string;
  estado_resultado: EstadoResultadoArqueo;
  alerta_posible_reclamo_cliente: boolean;
  observaciones_cierre: string | null;
  detalles: DetalleArqueoMetodoDTO[];
}
