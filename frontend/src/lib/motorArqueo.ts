import { formatearFechaHoraArgentina, formatearPesos } from './formatMoney';
import type {
  ArqueoCierre,
  EstadoResultadoArqueo,
  TurnoActivo,
} from '../services/api';

function aCentavos(decimalStr: string): bigint {
  const limpio = decimalStr.trim();
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(limpio);
  if (!match) return 0n;

  const negativo = Boolean(match[1]);
  const enteros = BigInt(match[2] ?? '0');
  const dec = BigInt((match[3] ?? '00').padEnd(2, '0'));
  const total = enteros * 100n + dec;
  return negativo ? -total : total;
}

function centavosAString(centavos: bigint): string {
  const negativo = centavos < 0n;
  const abs = negativo ? -centavos : centavos;
  const enteros = abs / 100n;
  const dec = (abs % 100n).toString().padStart(2, '0');
  return `${negativo ? '-' : ''}${enteros}.${dec}`;
}

export interface SimulacionArqueoEnVivo {
  multiploAplicado: string;
  efectivoEsperado: string;
  efectivoDeclarado: string;
  totalEsperadoGeneral: string;
  totalDeclaradoGeneral: string;
  ajusteRedondeoTotal: string;
  diferenciaRealTotal: string;
  estadoResultado: EstadoResultadoArqueo;
  alertaPosibleReclamoCliente: boolean;
}

/**
 * Replica exacta en centavos (BigInt, sin float) del motor determinístico del backend (RN-03, RN-04, RN-07).
 */
export function simularArqueoEnVivo(
  turno: TurnoActivo,
  efectivoDeclaradoDecimal: string,
): SimulacionArqueoEnVivo {
  const multiploCentavos = aCentavos(
    turno.configuracion.multiplo_redondeo_efectivo,
  );
  const efectivoDeclaradoCent = aCentavos(efectivoDeclaradoDecimal);

  let efectivoEsperadoCent = 0n;
  let totalEsperadoCent = 0n;
  let totalDeclaradoCent = 0n;
  let ajusteTotalCent = 0n;
  let diferenciaTotalCent = 0n;

  for (const metodo of turno.subtotales_por_metodo) {
    const esperadoCent = aCentavos(metodo.monto_esperado);
    const declaradoCent =
      metodo.codigo_metodo === 'EFECTIVO'
        ? efectivoDeclaradoCent
        : esperadoCent < 0n
          ? 0n
          : esperadoCent;

    if (metodo.codigo_metodo === 'EFECTIVO') {
      efectivoEsperadoCent = esperadoCent;
    }

    const diferenciaBrutaCent = declaradoCent - esperadoCent;
    let ajusteCent = 0n;

    if (
      metodo.permite_redondeo &&
      multiploCentavos > 0n &&
      diferenciaBrutaCent < 0n &&
      -diferenciaBrutaCent < multiploCentavos
    ) {
      ajusteCent = diferenciaBrutaCent;
    }

    const diferenciaRealCent = diferenciaBrutaCent - ajusteCent;

    totalEsperadoCent += esperadoCent;
    totalDeclaradoCent += declaradoCent;
    ajusteTotalCent += ajusteCent;
    diferenciaTotalCent += diferenciaRealCent;
  }

  let estadoResultado: EstadoResultadoArqueo;
  if (diferenciaTotalCent === 0n && ajusteTotalCent === 0n) {
    estadoResultado = 'CUADRE_PERFECTO';
  } else if (diferenciaTotalCent === 0n && ajusteTotalCent !== 0n) {
    estadoResultado = 'DENTRO_TOLERANCIA';
  } else if (diferenciaTotalCent > 0n) {
    estadoResultado = 'SOBRANTE';
  } else {
    estadoResultado = 'FALTANTE';
  }

  return {
    multiploAplicado: centavosAString(multiploCentavos),
    efectivoEsperado: centavosAString(efectivoEsperadoCent),
    efectivoDeclarado: centavosAString(efectivoDeclaradoCent),
    totalEsperadoGeneral: centavosAString(totalEsperadoCent),
    totalDeclaradoGeneral: centavosAString(totalDeclaradoCent),
    ajusteRedondeoTotal: centavosAString(ajusteTotalCent),
    diferenciaRealTotal: centavosAString(diferenciaTotalCent),
    estadoResultado,
    alertaPosibleReclamoCliente:
      diferenciaTotalCent > 0n && diferenciaTotalCent > multiploCentavos,
  };
}

function textoEstadoArqueo(estado: EstadoResultadoArqueo): string {
  switch (estado) {
    case 'CUADRE_PERFECTO':
      return 'CUADRE PERFECTO ($ 0,00)';
    case 'DENTRO_TOLERANCIA':
      return 'DENTRO DE TOLERANCIA / REDONDEO';
    case 'SOBRANTE':
      return 'SOBRANTE A FAVOR DE EMPRESA';
    case 'FALTANTE':
      return 'FALTANTE IMPUTABLE AL CIERRE';
  }
}

export function generarResumenWhatsApp(arqueo: ArqueoCierre): string {
  const lineasCanales = arqueo.detalles.map((d) => {
    const base = `- ${d.nombre_metodo}: Esperado ${formatearPesos(d.monto_esperado)} | Declarado ${formatearPesos(d.monto_declarado)}`;
    if (d.codigo_metodo === 'EFECTIVO') {
      return `${base} | Ajuste ${formatearPesos(d.ajuste_redondeo)} | Dif. real ${formatearPesos(d.diferencia_real)}`;
    }
    return `${base} (Conciliación exacta)`;
  });

  const lineas: string[] = [
    `*CIERRE DE CAJA · ${arqueo.nombre_comercio}*`,
    `Terminal: Caja #${arqueo.caja.numero_caja} (${arqueo.caja.nombre_caja})`,
    `Apertura: ${formatearFechaHoraArgentina(arqueo.fecha_hora_apertura)} hs (${arqueo.usuario_apertura.nombre_completo})`,
    `Cierre: ${formatearFechaHoraArgentina(arqueo.fecha_hora_cierre)} hs (${arqueo.usuario_cierre.nombre_completo})`,
    `Fondo inicial efectivo: ${formatearPesos(arqueo.fondo_inicial_efectivo)}`,
    `Regla redondeo aplicada: ${arqueo.multiplo_redondeo_aplicado === '0.00' ? '$ 0,00 (Estricto)' : formatearPesos(arqueo.multiplo_redondeo_aplicado)}`,
    '',
    '*Desglose por método de pago:*',
    ...lineasCanales,
    '',
    `Total esperado general: ${formatearPesos(arqueo.total_esperado_general)}`,
    `Total declarado general: ${formatearPesos(arqueo.total_declarado_general)}`,
    `Ajuste redondeo total: ${formatearPesos(arqueo.ajuste_redondeo_total)}`,
    `Diferencia real neta: ${formatearPesos(arqueo.diferencia_real_total)}`,
    `Resultado: ${textoEstadoArqueo(arqueo.estado_resultado)}`,
  ];

  if (arqueo.alerta_posible_reclamo_cliente) {
    lineas.push(
      'ALERTA: Sobrante superior al margen configurado (posible reclamo de cliente).',
    );
  }

  if (arqueo.observaciones_cierre) {
    lineas.push(`Observaciones: ${arqueo.observaciones_cierre}`);
  }

  return lineas.join('\n');
}
