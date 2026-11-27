import type { ConfiguracionCaja } from '../../domain/entities/ConfiguracionCaja.js';
import type { Usuario } from '../../domain/entities/Usuario.js';
import type { OperadorPublicoDTO } from './TurnoActivoDTO.js';

export interface ConfiguracionCajaDTO {
  id_configuracion: string;
  nombre_comercio: string;
  multiplo_redondeo_efectivo: string;
  fecha_ultima_actualizacion: string;
  usuario_actualizacion: OperadorPublicoDTO | null;
}

export function mapearConfiguracionCajaDTO(
  config: ConfiguracionCaja,
  usuarioActualizacion: Usuario | null,
): ConfiguracionCajaDTO {
  return {
    id_configuracion: config.idConfiguracion,
    nombre_comercio: config.nombreComercio,
    multiplo_redondeo_efectivo: config.getMultiploRedondeoEfectivo().aString(),
    fecha_ultima_actualizacion: config.fechaUltimaActualizacion.toISOString(),
    usuario_actualizacion: usuarioActualizacion
      ? {
          id_usuario: usuarioActualizacion.idUsuario,
          nombre_completo: usuarioActualizacion.nombreCompleto,
          rol_usuario: usuarioActualizacion.rolUsuario,
        }
      : null,
  };
}
