import { MontoInvalidoError } from '../errors/DominioError.js';
import type { EstrategiaRedondeo } from '../strategy/EstrategiaRedondeo.js';
import { Dinero } from '../value-objects/Dinero.js';
import type { MetodoPago } from './MetodoPago.js';

export interface DetalleArqueoMetodoProps {
  idDetalleArqueo: string;
  idArqueo: string;
  metodoPago: MetodoPago;
  montoEsperado: Dinero;
  montoDeclarado: Dinero;
}

/**
 * Línea de conciliación por método de pago dentro de un ArqueoCierre (RN-02, RN-03, RN-07).
 */
export class DetalleArqueoMetodo {
  readonly idDetalleArqueo: string;
  readonly idArqueo: string;
  readonly metodoPago: MetodoPago;
  readonly montoEsperado: Dinero;
  readonly montoDeclarado: Dinero;
  private _ajusteRedondeo: Dinero = Dinero.cero();
  private _diferenciaReal: Dinero = Dinero.cero();

  constructor(props: DetalleArqueoMetodoProps) {
    if (props.montoDeclarado.esNegativo()) {
      throw new MontoInvalidoError(
        'El monto declarado en el arqueo debe ser mayor o igual a cero (RN-06).',
      );
    }

    this.idDetalleArqueo = props.idDetalleArqueo;
    this.idArqueo = props.idArqueo;
    this.metodoPago = props.metodoPago;
    this.montoEsperado = props.montoEsperado;
    this.montoDeclarado = props.montoDeclarado;
  }

  get ajusteRedondeo(): Dinero {
    return this._ajusteRedondeo;
  }

  get diferenciaReal(): Dinero {
    return this._diferenciaReal;
  }

  obtenerDiferenciaBruta(): Dinero {
    return this.montoDeclarado.restar(this.montoEsperado);
  }

  /**
   * Aplica la estrategia de redondeo del canal manteniendo la invariante:
   * Diferencia Bruta = Ajuste por Redondeo + Diferencia Real (RN-07).
   */
  calcularDiferencia(estrategia: EstrategiaRedondeo): void {
    const diferenciaBruta = this.obtenerDiferenciaBruta();
    this._ajusteRedondeo = estrategia.calcularAjuste(diferenciaBruta);
    this._diferenciaReal = diferenciaBruta.restar(this._ajusteRedondeo);
  }
}
