import type { EstadoResultadoArqueo } from '../../domain/entities/ArqueoCierre.js';
import { RangoFechasInvalidoError } from '../../domain/errors/DominioError.js';
import { Dinero } from '../../domain/value-objects/Dinero.js';
import type {
  AcumuladoMensualCajeroDTO,
  ArqueoCierreDTO,
  HistorialArqueosResultadoDTO,
  ResumenHistorialArqueosDTO,
} from '../dto/ArqueoDTO.js';
import type { OperadorPublicoDTO } from '../dto/TurnoActivoDTO.js';
import type { ArqueoRepositoryPort } from '../ports/out/ArqueoRepositoryPort.js';

export interface ConsultarHistorialArqueosInput {
  fechaDesde?: string;
  fechaHasta?: string;
  idUsuario?: string;
  idCaja?: string;
  estadoResultado?: EstadoResultadoArqueo;
  mes?: string;
}

function obtenerMesActualArgentina(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  return `${year}-${month}`;
}

function limitesMesArgentina(mes: string): { inicio: Date; fin: Date } {
  const [yearStr = '2026', monthStr = '01'] = mes.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const ultimoDia = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    inicio: new Date(`${yearStr}-${monthStr}-01T00:00:00.000-03:00`),
    fin: new Date(
      `${yearStr}-${monthStr}-${String(ultimoDia).padStart(2, '0')}T23:59:59.999-03:00`,
    ),
  };
}

/**
 * Caso de uso CU-ConsultarHistorial (Issue #7 · RF-05, RN-04, RN-08).
 * Devuelve el historial filtrado de cierres junto al acumulado mensual por cajero (anti robo hormiga).
 */
export class ConsultarHistorialArqueosUseCase {
  constructor(private readonly arqueoRepo: ArqueoRepositoryPort) {}

  async ejecutar(
    input: ConsultarHistorialArqueosInput,
  ): Promise<HistorialArqueosResultadoDTO> {
    const fechaDesde = input.fechaDesde
      ? new Date(`${input.fechaDesde}T00:00:00.000-03:00`)
      : undefined;
    const fechaHasta = input.fechaHasta
      ? new Date(`${input.fechaHasta}T23:59:59.999-03:00`)
      : undefined;

    if (fechaDesde && fechaHasta && fechaDesde.getTime() > fechaHasta.getTime()) {
      throw new RangoFechasInvalidoError();
    }

    const mesAcumulado = input.mes ?? obtenerMesActualArgentina();
    const { inicio: inicioMes, fin: finMes } = limitesMesArgentina(mesAcumulado);

    const [arqueosBase, arqueosDelMes] = await Promise.all([
      this.arqueoRepo.listar({
        fechaDesde,
        fechaHasta,
        idUsuarioOperador: input.idUsuario,
        idCaja: input.idCaja,
      }),
      this.arqueoRepo.listar({
        fechaDesde: inicioMes,
        fechaHasta: finMes,
      }),
    ]);

    const arqueosFiltrados = input.estadoResultado
      ? arqueosBase.filter((a) => a.estado_resultado === input.estadoResultado)
      : arqueosBase;

    const resumenFiltrado = this.calcularResumen(arqueosFiltrados);
    const acumuladoPorCajero = this.calcularAcumuladoMensual(
      mesAcumulado,
      arqueosDelMes,
    );

    return {
      mes_acumulado: mesAcumulado,
      arqueos: arqueosFiltrados,
      acumulado_mensual_por_cajero: acumuladoPorCajero,
      resumen_filtrado: resumenFiltrado,
    };
  }

  private calcularResumen(
    arqueos: ArqueoCierreDTO[],
  ): ResumenHistorialArqueosDTO {
    let totalEsperado = Dinero.cero();
    let totalDeclarado = Dinero.cero();
    let totalAjuste = Dinero.cero();
    let totalDiferencia = Dinero.cero();

    for (const a of arqueos) {
      totalEsperado = totalEsperado.sumar(Dinero.desde(a.total_esperado_general));
      totalDeclarado = totalDeclarado.sumar(
        Dinero.desde(a.total_declarado_general),
      );
      totalAjuste = totalAjuste.sumar(Dinero.desde(a.ajuste_redondeo_total));
      totalDiferencia = totalDiferencia.sumar(
        Dinero.desde(a.diferencia_real_total),
      );
    }

    return {
      cantidad_cierres: arqueos.length,
      total_esperado: totalEsperado.aString(),
      total_declarado: totalDeclarado.aString(),
      total_ajuste_redondeo: totalAjuste.aString(),
      total_diferencia_real: totalDiferencia.aString(),
    };
  }

  private calcularAcumuladoMensual(
    mes: string,
    arqueosDelMes: ArqueoCierreDTO[],
  ): AcumuladoMensualCajeroDTO[] {
    interface Acumulador {
      usuario: OperadorPublicoDTO;
      cantidadCierres: number;
      cierresConAjuste: number;
      cierresConFaltante: number;
      cierresConSobrante: number;
      totalDeclarado: Dinero;
      acumuladoAjuste: Dinero;
      acumuladoDiferencia: Dinero;
      acumuladoFaltantes: Dinero;
      acumuladoSobrantes: Dinero;
    }

    const mapa = new Map<string, Acumulador>();

    for (const a of arqueosDelMes) {
      const idOperador = a.usuario_apertura.id_usuario;
      let acc = mapa.get(idOperador);
      if (!acc) {
        acc = {
          usuario: a.usuario_apertura,
          cantidadCierres: 0,
          cierresConAjuste: 0,
          cierresConFaltante: 0,
          cierresConSobrante: 0,
          totalDeclarado: Dinero.cero(),
          acumuladoAjuste: Dinero.cero(),
          acumuladoDiferencia: Dinero.cero(),
          acumuladoFaltantes: Dinero.cero(),
          acumuladoSobrantes: Dinero.cero(),
        };
        mapa.set(idOperador, acc);
      }

      const declarado = Dinero.desde(a.total_declarado_general);
      const ajuste = Dinero.desde(a.ajuste_redondeo_total);
      const diferencia = Dinero.desde(a.diferencia_real_total);

      acc.cantidadCierres += 1;
      acc.totalDeclarado = acc.totalDeclarado.sumar(declarado);
      acc.acumuladoAjuste = acc.acumuladoAjuste.sumar(ajuste);
      acc.acumuladoDiferencia = acc.acumuladoDiferencia.sumar(diferencia);

      if (!ajuste.esCero()) {
        acc.cierresConAjuste += 1;
      }
      if (diferencia.esNegativo()) {
        acc.cierresConFaltante += 1;
        acc.acumuladoFaltantes = acc.acumuladoFaltantes.sumar(diferencia);
      } else if (diferencia.esPositivo()) {
        acc.cierresConSobrante += 1;
        acc.acumuladoSobrantes = acc.acumuladoSobrantes.sumar(diferencia);
      }
    }

    const umbralAlerta = Dinero.desde('1000.00');

    return Array.from(mapa.values())
      .map((acc) => ({
        mes,
        usuario: acc.usuario,
        cantidad_cierres: acc.cantidadCierres,
        cierres_con_ajuste_tolerancia: acc.cierresConAjuste,
        cierres_con_faltante_real: acc.cierresConFaltante,
        cierres_con_sobrante_real: acc.cierresConSobrante,
        total_declarado_mes: acc.totalDeclarado.aString(),
        acumulado_ajuste_redondeo: acc.acumuladoAjuste.aString(),
        acumulado_diferencia_real: acc.acumuladoDiferencia.aString(),
        acumulado_faltantes_reales: acc.acumuladoFaltantes.aString(),
        acumulado_sobrantes_reales: acc.acumuladoSobrantes.aString(),
        alerta_sesgo_tolerancia:
          acc.cierresConAjuste >= 3 ||
          acc.acumuladoAjuste.absoluto().mayorOIgualQue(umbralAlerta),
      }))
      .sort((a, b) => {
        const ajA = Dinero.desde(a.acumulado_ajuste_redondeo);
        const ajB = Dinero.desde(b.acumulado_ajuste_redondeo);
        if (ajA.menorQue(ajB)) return -1;
        if (ajA.mayorQue(ajB)) return 1;
        return b.cantidad_cierres - a.cantidad_cierres;
      });
  }
}
