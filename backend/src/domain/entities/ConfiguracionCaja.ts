import {
  MontoInvalidoError,
  RolNoAutorizadoError,
} from '../errors/DominioError.js';
import type { Dinero } from '../value-objects/Dinero.js';
import type { Usuario } from './Usuario.js';

export interface ConfiguracionCajaProps {
  idConfiguracion: string;
  nombreComercio: string;
  multiploRedondeoEfectivo: Dinero;
  idUsuarioActualizacion: string;
  fechaUltimaActualizacion: Date;
}

/**
 * Parámetros comerciales globales de caja (RN-04, RF-09).
 * Solo un ENCARGADO puede actualizar el margen de tolerancia/redondeo (RN-08).
 */
export class ConfiguracionCaja {
  readonly idConfiguracion: string;
  readonly nombreComercio: string;
  private multiploRedondeoEfectivo: Dinero;
  private _idUsuarioActualizacion: string;
  private _fechaUltimaActualizacion: Date;

  constructor(props: ConfiguracionCajaProps) {
    if (props.multiploRedondeoEfectivo.esNegativo()) {
      throw new MontoInvalidoError(
        'El margen de tolerancia/redondeo en efectivo no puede ser negativo (RN-04, RN-06).',
      );
    }

    this.idConfiguracion = props.idConfiguracion;
    this.nombreComercio = props.nombreComercio;
    this.multiploRedondeoEfectivo = props.multiploRedondeoEfectivo;
    this._idUsuarioActualizacion = props.idUsuarioActualizacion;
    this._fechaUltimaActualizacion = props.fechaUltimaActualizacion;
  }

  get idUsuarioActualizacion(): string {
    return this._idUsuarioActualizacion;
  }

  get fechaUltimaActualizacion(): Date {
    return this._fechaUltimaActualizacion;
  }

  getMultiploRedondeoEfectivo(): Dinero {
    return this.multiploRedondeoEfectivo;
  }

  actualizarMultiplo(
    nuevoMultiplo: Dinero,
    encargado: Usuario,
    fecha: Date = new Date(),
  ): void {
    if (!encargado.puedeConfigurarRedondeo()) {
      throw new RolNoAutorizadoError(
        'Solo un usuario con rol ENCARGADO puede configurar el redondeo comercial (RN-08).',
      );
    }

    if (nuevoMultiplo.esNegativo()) {
      throw new MontoInvalidoError(
        'El margen de tolerancia/redondeo en efectivo no puede ser negativo (RN-04, RN-06).',
      );
    }

    this.multiploRedondeoEfectivo = nuevoMultiplo;
    this._idUsuarioActualizacion = encargado.idUsuario;
    this._fechaUltimaActualizacion = fecha;
  }
}
