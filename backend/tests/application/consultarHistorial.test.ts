import { describe, expect, it } from 'vitest';
import { CajaFacade } from '../../src/application/facade/CajaFacade.js';
import { RangoFechasInvalidoError } from '../../src/domain/errors/DominioError.js';
import {
  crearContextoEnMemoria,
  TEST_IDS,
} from '../helpers/inMemoryAdapters.js';

function obtenerMesActualAr(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const m = parts.find((p) => p.type === 'month')?.value ?? '11';
  return `${y}-${m}`;
}

describe('CajaFacade · Historial de Cierres y Acumulado Mensual (Issue #7 · RF-05, RN-04)', () => {
  it('agrupa el acumulado mensual por cajero, activa alerta de sesgo y filtra por operador, caja y estado', async () => {
    const ctx = crearContextoEnMemoria();
    const facade = new CajaFacade(ctx);

    await facade.configurarRedondeo({
      idUsuarioEncargado: TEST_IDS.encargado,
      multiploRedondeoEfectivo: '500.00',
    });

    // Cajero 1 (Lucas): 3 cierres DENTRO_TOLERANCIA (-$200, -$350, -$150 => -$700 acumulado + 3 eventos -> alerta_sesgo_tolerancia = true)
    for (const faltanteMenor of ['9800.00', '9650.00', '9850.00']) {
      const t = await facade.abrirTurno(
        TEST_IDS.cajero1,
        TEST_IDS.caja1,
        '10000.00',
      );
      await facade.cerrarTurno({
        idTurno: t.id_turno,
        idUsuarioCierre: TEST_IDS.cajero1,
        rolUsuario: 'CAJERO',
        efectivoDeclarado: faltanteMenor,
      });
    }

    // Cajero 2 (Sofía): 1 cuadre perfecto y 1 sobrante en Caja #2
    const ts1 = await facade.abrirTurno(
      TEST_IDS.cajero2,
      TEST_IDS.caja2,
      '15000.00',
    );
    await facade.cerrarTurno({
      idTurno: ts1.id_turno,
      idUsuarioCierre: TEST_IDS.cajero2,
      rolUsuario: 'CAJERO',
      efectivoDeclarado: '15000.00',
    });

    const ts2 = await facade.abrirTurno(
      TEST_IDS.cajero2,
      TEST_IDS.caja2,
      '10000.00',
    );
    await facade.cerrarTurno({
      idTurno: ts2.id_turno,
      idUsuarioCierre: TEST_IDS.cajero2,
      rolUsuario: 'CAJERO',
      efectivoDeclarado: '10800.00',
    });

    const mesActual = obtenerMesActualAr();
    const completo = await facade.consultarHistorialArqueos({
      mes: mesActual,
    });

    expect(completo.mes_acumulado).toBe(mesActual);
    expect(completo.arqueos).toHaveLength(5);
    expect(completo.resumen_filtrado.cantidad_cierres).toBe(5);
    expect(completo.resumen_filtrado.total_ajuste_redondeo).toBe('-700.00');
    expect(completo.resumen_filtrado.total_diferencia_real).toBe('800.00');

    expect(completo.acumulado_mensual_por_cajero).toHaveLength(2);
    const acumLucas = completo.acumulado_mensual_por_cajero[0];
    expect(acumLucas?.usuario.id_usuario).toBe(TEST_IDS.cajero1);
    expect(acumLucas?.cantidad_cierres).toBe(3);
    expect(acumLucas?.cierres_con_ajuste_tolerancia).toBe(3);
    expect(acumLucas?.acumulado_ajuste_redondeo).toBe('-700.00');
    expect(acumLucas?.alerta_sesgo_tolerancia).toBe(true);

    const acumSofia = completo.acumulado_mensual_por_cajero[1];
    expect(acumSofia?.usuario.id_usuario).toBe(TEST_IDS.cajero2);
    expect(acumSofia?.cantidad_cierres).toBe(2);
    expect(acumSofia?.cierres_con_ajuste_tolerancia).toBe(0);
    expect(acumSofia?.cierres_con_sobrante_real).toBe(1);
    expect(acumSofia?.acumulado_sobrantes_reales).toBe('800.00');
    expect(acumSofia?.alerta_sesgo_tolerancia).toBe(false);

    // Filtros combinados
    const soloSofiaSobrante = await facade.consultarHistorialArqueos({
      idUsuario: TEST_IDS.cajero2,
      idCaja: TEST_IDS.caja2,
      estadoResultado: 'SOBRANTE',
      mes: mesActual,
    });
    expect(soloSofiaSobrante.arqueos).toHaveLength(1);
    expect(soloSofiaSobrante.resumen_filtrado.total_diferencia_real).toBe(
      '800.00',
    );
    // El acumulado mensual sigue reflejando el mes completo de todos los cajeros
    expect(soloSofiaSobrante.acumulado_mensual_por_cajero).toHaveLength(2);
  });

  it('rechaza rango de fechas invertido (fecha_desde > fecha_hasta)', async () => {
    const ctx = crearContextoEnMemoria();
    const facade = new CajaFacade(ctx);

    await expect(
      facade.consultarHistorialArqueos({
        fechaDesde: '2026-11-28',
        fechaHasta: '2026-11-20',
      }),
    ).rejects.toThrow(RangoFechasInvalidoError);
  });
});
