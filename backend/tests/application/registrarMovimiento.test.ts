import { describe, expect, it } from 'vitest';
import { CajaFacade } from '../../src/application/facade/CajaFacade.js';
import {
  ConceptoObligatorioError,
  MontoInvalidoError,
  RolNoAutorizadoError,
  TurnoCerradoError,
} from '../../src/domain/errors/DominioError.js';
import { EstadoTurnoCerrado } from '../../src/domain/state/EstadoTurnoCerrado.js';
import {
  crearContextoEnMemoria,
  TEST_IDS,
} from '../helpers/inMemoryAdapters.js';

describe('CajaFacade · Registro Rápido de Movimientos y Subtotales en Vivo (Issue #3)', () => {
  it('recalcula subtotales por método sin mezclar canales y mantiene precisión decimal (RN-02, RN-06)', async () => {
    const ctx = crearContextoEnMemoria();
    const facade = new CajaFacade(ctx);

    const turno = await facade.abrirTurno(TEST_IDS.cajero1, TEST_IDS.caja1, '15000.00');

    await facade.registrarMovimiento({
      idTurno: turno.id_turno,
      idUsuario: TEST_IDS.cajero1,
      rolUsuario: 'CAJERO',
      codigoMetodoPago: 'EFECTIVO',
      tipoMovimiento: 'INGRESO',
      montoOperacion: '12500.10',
      conceptoDescripcion: 'Venta mostrador varios',
      origenCarga: 'MANUAL',
    });

    await facade.registrarMovimiento({
      idTurno: turno.id_turno,
      idUsuario: TEST_IDS.cajero1,
      rolUsuario: 'CAJERO',
      codigoMetodoPago: 'EFECTIVO',
      tipoMovimiento: 'EGRESO',
      montoOperacion: '8500.05',
      conceptoDescripcion: 'Pago a proveedor de soda',
      origenCarga: 'MANUAL',
    });

    const ultimo = await facade.registrarMovimiento({
      idTurno: turno.id_turno,
      idUsuario: TEST_IDS.cajero1,
      rolUsuario: 'CAJERO',
      codigoMetodoPago: 'QR_TRANSFERENCIA',
      tipoMovimiento: 'INGRESO',
      montoOperacion: '24200.20',
      conceptoDescripcion: 'Compra cliente',
      origenCarga: 'MANUAL',
    });

    const efec = ultimo.turno.subtotales_por_metodo.find(
      (m) => m.codigo_metodo === 'EFECTIVO',
    );
    const qr = ultimo.turno.subtotales_por_metodo.find(
      (m) => m.codigo_metodo === 'QR_TRANSFERENCIA',
    );
    const tarj = ultimo.turno.subtotales_por_metodo.find(
      (m) => m.codigo_metodo === 'TARJETA',
    );

    // 15000.00 + 12500.10 - 8500.05 = 19000.05
    expect(efec?.monto_esperado).toBe('19000.05');
    expect(qr?.monto_esperado).toBe('24200.20');
    expect(tarj?.monto_esperado).toBe('0.00');

    const libro = await facade.listarMovimientosTurno(turno.id_turno, {
      idUsuario: TEST_IDS.cajero1,
      rolUsuario: 'CAJERO',
    });
    expect(libro).toHaveLength(3);
  });

  it('rechaza egresos sin concepto y montos <= 0 (RN-06)', async () => {
    const ctx = crearContextoEnMemoria();
    const facade = new CajaFacade(ctx);
    const turno = await facade.abrirTurno(TEST_IDS.cajero1, TEST_IDS.caja1, '10000.00');

    await expect(
      facade.registrarMovimiento({
        idTurno: turno.id_turno,
        idUsuario: TEST_IDS.cajero1,
        rolUsuario: 'CAJERO',
        codigoMetodoPago: 'EFECTIVO',
        tipoMovimiento: 'EGRESO',
        montoOperacion: '500.00',
        conceptoDescripcion: null,
        origenCarga: 'MANUAL',
      }),
    ).rejects.toThrow(ConceptoObligatorioError);

    await expect(
      facade.registrarMovimiento({
        idTurno: turno.id_turno,
        idUsuario: TEST_IDS.cajero1,
        rolUsuario: 'CAJERO',
        codigoMetodoPago: 'EFECTIVO',
        tipoMovimiento: 'INGRESO',
        montoOperacion: '0.00',
        conceptoDescripcion: 'Cero',
        origenCarga: 'MANUAL',
      }),
    ).rejects.toThrow(MontoInvalidoError);
  });

  it('impide a otro cajero cargar en una caja ajena (RN-08) y bloquea turnos cerrados (RN-05)', async () => {
    const ctx = crearContextoEnMemoria();
    const facade = new CajaFacade(ctx);
    const turno = await facade.abrirTurno(TEST_IDS.cajero1, TEST_IDS.caja1, '10000.00');

    await expect(
      facade.registrarMovimiento({
        idTurno: turno.id_turno,
        idUsuario: TEST_IDS.cajero2,
        rolUsuario: 'CAJERO',
        codigoMetodoPago: 'EFECTIVO',
        tipoMovimiento: 'INGRESO',
        montoOperacion: '1000.00',
        conceptoDescripcion: 'Intento ajeno',
        origenCarga: 'MANUAL',
      }),
    ).rejects.toThrow(RolNoAutorizadoError);

    // Cerrar el turno vía patrón State
    const entidadTurno = await ctx.turnoRepo.buscarPorId(turno.id_turno);
    entidadTurno!.cambiarEstado(new EstadoTurnoCerrado());

    await expect(
      facade.registrarMovimiento({
        idTurno: turno.id_turno,
        idUsuario: TEST_IDS.cajero1,
        rolUsuario: 'CAJERO',
        codigoMetodoPago: 'EFECTIVO',
        tipoMovimiento: 'INGRESO',
        montoOperacion: '1000.00',
        conceptoDescripcion: 'Turno cerrado',
        origenCarga: 'MANUAL',
      }),
    ).rejects.toThrow(TurnoCerradoError);
  });
});
