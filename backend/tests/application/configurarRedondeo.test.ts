import { describe, expect, it } from 'vitest';
import { CajaFacade } from '../../src/application/facade/CajaFacade.js';
import {
  MontoInvalidoError,
  RolNoAutorizadoError,
} from '../../src/domain/errors/DominioError.js';
import {
  crearContextoEnMemoria,
  TEST_IDS,
} from '../helpers/inMemoryAdapters.js';

describe('CajaFacade · Configuración de Redondeo / Tolerancia (Issue #5 · RF-09, RN-04, RN-08)', () => {
  it('permite consultar la configuración y actualizarla con rol ENCARGADO', async () => {
    const ctx = crearContextoEnMemoria();
    const facade = new CajaFacade(ctx);

    const inicial = await facade.obtenerConfiguracionCaja();
    expect(inicial.multiplo_redondeo_efectivo).toBe('0.00');
    expect(inicial.usuario_actualizacion?.nombre_completo).toBe('Martín Ruiz');

    const a100 = await facade.configurarRedondeo({
      idUsuarioEncargado: TEST_IDS.encargado,
      multiploRedondeoEfectivo: '100.00',
    });
    expect(a100.multiplo_redondeo_efectivo).toBe('100.00');
    expect(a100.usuario_actualizacion?.id_usuario).toBe(TEST_IDS.encargado);

    const a500 = await facade.configurarRedondeo({
      idUsuarioEncargado: TEST_IDS.encargado,
      multiploRedondeoEfectivo: '500',
    });
    expect(a500.multiplo_redondeo_efectivo).toBe('500.00');

    const vueltaEstricto = await facade.configurarRedondeo({
      idUsuarioEncargado: TEST_IDS.encargado,
      multiploRedondeoEfectivo: '0',
    });
    expect(vueltaEstricto.multiplo_redondeo_efectivo).toBe('0.00');
  });

  it('rechaza configuración por CAJERO (RN-08) y valores negativos (RN-06)', async () => {
    const ctx = crearContextoEnMemoria();
    const facade = new CajaFacade(ctx);

    await expect(
      facade.configurarRedondeo({
        idUsuarioEncargado: TEST_IDS.cajero1,
        multiploRedondeoEfectivo: '100.00',
      }),
    ).rejects.toThrow(RolNoAutorizadoError);

    await expect(
      facade.configurarRedondeo({
        idUsuarioEncargado: TEST_IDS.encargado,
        multiploRedondeoEfectivo: '-10.00',
      }),
    ).rejects.toThrow(MontoInvalidoError);

    const actual = await facade.obtenerConfiguracionCaja();
    expect(actual.multiplo_redondeo_efectivo).toBe('0.00');
  });
});
