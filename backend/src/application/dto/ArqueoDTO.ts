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

export interface AcumuladoMensualCajeroDTO {
  mes: string;
  usuario: OperadorPublicoDTO;
  cantidad_cierres: number;
  cierres_con_ajuste_tolerancia: number;
  cierres_con_faltante_real: number;
  cierres_con_sobrante_real: number;
  total_declarado_mes: string;
  acumulado_ajuste_redondeo: string;
  acumulado_diferencia_real: string;
  acumulado_faltantes_reales: string;
  acumulado_sobrantes_reales: string;
  alerta_sesgo_tolerancia: boolean;
}

export interface ResumenHistorialArqueosDTO {
  cantidad_cierres: number;
  total_esperado: string;
  total_declarado: string;
  total_ajuste_redondeo: string;
  total_diferencia_real: string;
}

export interface HistorialArqueosResultadoDTO {
  mes_acumulado: string;
  arqueos: ArqueoCierreDTO[];
  acumulado_mensual_por_cajero: AcumuladoMensualCajeroDTO[];
  resumen_filtrado: ResumenHistorialArqueosDTO;
}
