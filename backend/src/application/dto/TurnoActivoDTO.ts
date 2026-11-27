import type { RolUsuario } from '../../domain/entities/Usuario.js';
import type { CodigoEstadoTurno } from '../../domain/state/EstadoTurno.js';

export interface OperadorPublicoDTO {
  id_usuario: string;
  nombre_completo: string;
  rol_usuario: RolUsuario;
}

export interface CajaResumenDTO {
  id_caja: string;
  numero_caja: number;
  nombre_caja: string;
}

export interface SubtotalMetodoDTO {
  id_metodo_pago: string;
  codigo_metodo: string;
  nombre_metodo: string;
  permite_redondeo: boolean;
  monto_esperado: string;
}

export interface ConfiguracionPublicaDTO {
  nombre_comercio: string;
  multiplo_redondeo_efectivo: string;
}

export interface TurnoActivoDTO {
  id_turno: string;
  estado_turno: CodigoEstadoTurno;
  fondo_inicial_efectivo: string;
  fecha_hora_apertura: string;
  fecha_hora_cierre: string | null;
  caja: CajaResumenDTO;
  usuario_apertura: OperadorPublicoDTO;
  subtotales_por_metodo: SubtotalMetodoDTO[];
  configuracion: ConfiguracionPublicaDTO;
}

export interface CajaConEstadoDTO extends CajaResumenDTO {
  estado_caja: 'LIBRE' | 'OCUPADA';
  turno_activo: {
    id_turno: string;
    fecha_hora_apertura: string;
    fondo_inicial_efectivo: string;
    usuario_apertura: OperadorPublicoDTO;
  } | null;
}
