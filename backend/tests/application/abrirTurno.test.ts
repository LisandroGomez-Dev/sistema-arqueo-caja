import { describe, expect, it } from 'vitest';
import { CajaFacade } from '../../src/application/facade/CajaFacade.js';
import {
  CajaOcupadaError,
  MontoInvalidoError,
  TurnoYaAbiertoError,
} from '../../src/domain/errors/DominioError.js';
import {
  InMemoryCajaRepository,
  InMemoryConfiguracionRepository,
  InMemoryPinHasher,
  InMemoryTurnoRepository,
  InMemoryUsuarioRepository,
  TEST_IDS,
} from '../helpers/inMemoryAdapters.js';

function crearFacade() {
  const usuarioRepo = new InMemoryUsuarioRepository();
  const configRepo = new InMemoryConfiguracionRepository();
  const cajaRepo = new InMemoryCajaRepository();
  const turnoRepo = new InMemoryTurnoRepository(usuarioRepo, cajaRepo, configRepo);
  cajaRepo.vincularTurnoRepo(turnoRepo);
  const pinHasher = new InMemoryPinHasher();
  return new CajaFacade({ turnoRepo, usuarioRepo, cajaRepo, configRepo, pinHasher });
}

describe('CajaFacade · Apertura Multi-Caja (Issue #2 · RN-02, RN-05, RN-06)', () => {
  it('permite abrir múltiples cajas en paralelo para distintos cajeros', async () => {
    const facade = crearFacade();

    const turno1 = await facade.abrirTurno(TEST_IDS.cajero1, TEST_IDS.caja1, '15000.00');
    const turno2 = await facade.abrirTurno(TEST_IDS.cajero2, TEST_IDS.caja2, '20000.00');

    expect(turno1.caja.numero_caja).toBe(1);
    expect(turno1.fondo_inicial_efectivo).toBe('15000.00');
    expect(turno2.caja.numero_caja).toBe(2);
    expect(turno2.fondo_inicial_efectivo).toBe('20000.00');

    const activos = await facade.listarTurnosActivos();
    expect(activos).toHaveLength(2);
    expect((await facade.obtenerTurnoActivo(TEST_IDS.cajero1))?.caja.numero_caja).toBe(1);
    expect((await facade.obtenerTurnoActivo(TEST_IDS.cajero2))?.caja.numero_caja).toBe(2);
  });

  it('impide que otro cajero abra una caja física que ya está ocupada (RN-05)', async () => {
    const facade = crearFacade();
    await facade.abrirTurno(TEST_IDS.cajero1, TEST_IDS.caja1, '10000.00');

    await expect(
      facade.abrirTurno(TEST_IDS.cajero2, TEST_IDS.caja1, '10000.00'),
    ).rejects.toThrow(CajaOcupadaError);
  });

  it('impide que un mismo cajero abra dos cajas al mismo tiempo (RN-05)', async () => {
    const facade = crearFacade();
    await facade.abrirTurno(TEST_IDS.cajero1, TEST_IDS.caja1, '10000.00');

    await expect(
      facade.abrirTurno(TEST_IDS.cajero1, TEST_IDS.caja2, '10000.00'),
    ).rejects.toThrow(TurnoYaAbiertoError);
  });

  it('rechaza fondo inicial negativo y permite $0.00 (RN-06)', async () => {
    const facade = crearFacade();

    await expect(
      facade.abrirTurno(TEST_IDS.cajero1, TEST_IDS.caja1, '-100.00'),
    ).rejects.toThrow(MontoInvalidoError);

    const turnoCero = await facade.abrirTurno(TEST_IDS.cajero1, TEST_IDS.caja1, '0.00');
    expect(turnoCero.fondo_inicial_efectivo).toBe('0.00');
  });
});
