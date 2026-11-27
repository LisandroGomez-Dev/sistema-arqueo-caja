import {
  MetodoDuplicadoEnArqueoError,
  MontoInvalidoError,
} from '../errors/DominioError.js';
import { Dinero } from '../value-objects/Dinero.js';
import { DetalleArqueoMetodo } from './DetalleArqueoMetodo.js';
import type { MetodoPago } from './MetodoPago.js';

export type EstadoResultadoArqueo =
  | 'CUADRE_PERFECTO'
  | 'DENTRO_TOLERANCIA'
  | 'SOBRANTE'
  | 'FALTANTE';

export interface ArqueoCierreProps {
  idArqueo: string;
  idTurno: string;
  idUsuarioCierre: string;
  multiploRedondeoAplicado: Dinero;
  observacionesCierre: string | null;
  fechaHoraCierre: Date;
}

export interface LineaCalculoArqueoInput {
  idDetalleArqueo: string;
  metodoPago: MetodoPago;
  montoEsperado: Dinero;
  montoDeclarado: Dinero;
}

/**
 * Arqueo definitivo de cierre de turno con foto histórica del margen de redondeo (RN-04, RN-07).
 */
export class ArqueoCierre {
  readonly idArqueo: string;
  readonly idTurno: string;
  readonly idUsuarioCierre: string;
  readonly multiploRedondeoAplicado: Dinero;
  readonly observacionesCierre: string | null;
  readonly fechaHoraCierre: Date;

  private readonly _detalles: DetalleArqueoMetodo[] = [];
  private _totalEsperadoGeneral: Dinero = Dinero.cero();
  private _totalDeclaradoGeneral: Dinero = Dinero.cero();
  private _ajusteRedondeoTotal: Dinero = Dinero.cero();
  private _diferenciaRealTotal: Dinero = Dinero.cero();

  constructor(props: ArqueoCierreProps) {
    if (props.multiploRedondeoAplicado.esNegativo()) {
      throw new MontoInvalidoError(
        'El múltiplo de redondeo aplicado en un arqueo no puede ser negativo (RN-04).',
      );
    }

    this.idArqueo = props.idArqueo;
    this.idTurno = props.idTurno;
    this.idUsuarioCierre = props.idUsuarioCierre;
    this.multiploRedondeoAplicado = props.multiploRedondeoAplicado;
    this.observacionesCierre = props.observacionesCierre;
    this.fechaHoraCierre = props.fechaHoraCierre;
  }

  static calcular(
    props: ArqueoCierreProps,
    lineas: LineaCalculoArqueoInput[],
  ): ArqueoCierre {
    const arqueo = new ArqueoCierre(props);

    for (const linea of lineas) {
      const detalle = new DetalleArqueoMetodo({
        idDetalleArqueo: linea.idDetalleArqueo,
        idArqueo: props.idArqueo,
        metodoPago: linea.metodoPago,
        montoEsperado: linea.montoEsperado,
        montoDeclarado: linea.montoDeclarado,
      });

      const estrategia = linea.metodoPago.obtenerEstrategiaRedondeo(
        props.multiploRedondeoAplicado,
      );
      detalle.calcularDiferencia(estrategia);
      arqueo.agregarDetalle(detalle);
    }

    arqueo.recalcularTotales();
    return arqueo;
  }

  get detalles(): readonly DetalleArqueoMetodo[] {
    return this._detalles;
  }

  get totalEsperadoGeneral(): Dinero {
    return this._totalEsperadoGeneral;
  }

  get totalDeclaradoGeneral(): Dinero {
    return this._totalDeclaradoGeneral;
  }

  get ajusteRedondeoTotal(): Dinero {
    return this._ajusteRedondeoTotal;
  }

  get diferenciaRealTotal(): Dinero {
    return this._diferenciaRealTotal;
  }

  agregarDetalle(detalle: DetalleArqueoMetodo): void {
    const yaExiste = this._detalles.some(
      (d) => d.metodoPago.idMetodoPago === detalle.metodoPago.idMetodoPago,
    );
    if (yaExiste) {
      throw new MetodoDuplicadoEnArqueoError();
    }
    this._detalles.push(detalle);
  }

  recalcularTotales(): void {
    let esperado = Dinero.cero();
    let declarado = Dinero.cero();
    let ajuste = Dinero.cero();
    let diferencia = Dinero.cero();

    for (const detalle of this._detalles) {
      esperado = esperado.sumar(detalle.montoEsperado);
      declarado = declarado.sumar(detalle.montoDeclarado);
      ajuste = ajuste.sumar(detalle.ajusteRedondeo);
      diferencia = diferencia.sumar(detalle.diferenciaReal);
    }

    this._totalEsperadoGeneral = esperado;
    this._totalDeclaradoGeneral = declarado;
    this._ajusteRedondeoTotal = ajuste;
    this._diferenciaRealTotal = diferencia;
  }

  obtenerEstadoResultado(): EstadoResultadoArqueo {
    if (
      this._diferenciaRealTotal.esCero() &&
      this._ajusteRedondeoTotal.esCero()
    ) {
      return 'CUADRE_PERFECTO';
    }

    if (
      this._diferenciaRealTotal.esCero() &&
      !this._ajusteRedondeoTotal.esCero()
    ) {
      return 'DENTRO_TOLERANCIA';
    }

    if (this._diferenciaRealTotal.esPositivo()) {
      return 'SOBRANTE';
    }

    return 'FALTANTE';
  }

  /**
   * Alerta de posible reclamo de cliente cuando existe un sobrante que supera el margen (RN-07).
   */
  requiereAlertaPosibleReclamoCliente(): boolean {
    return (
      this._diferenciaRealTotal.esPositivo() &&
      this._diferenciaRealTotal.mayorQue(this.multiploRedondeoAplicado)
    );
  }
}
