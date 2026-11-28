import { describe, expect, it } from 'vitest';
import { CajaFacade } from '../../src/application/facade/CajaFacade.js';
import {
  MontoInvalidoError,
  RolNoAutorizadoError,
  TurnoCerradoError,
} from '../../src/domain/errors/DominioError.js';
import {
  crearContextoEnMemoria,
  TEST_IDS,
} from '../helpers/inMemoryAdapters.js';

describe('CajaFacade · Arqueo y Cierre de Caja en 1 Clic (Issue #6 · RN-03, RN-04, RN-05, RN-07)', () => {
  it('cierra el turno dentro de tolerancia ($100 con -$30), bloquea modificaciones post-cierre y libera la caja física (RN-05)', async () => {
    const ctx = crearContextoEnMemoria();
    const facade = new CajaFacade(ctx);

    await facade.configurarRedondeo({
      idUsuarioEncargado: TEST_IDS.encargado,
      multiploRedondeoEfectivo: '100.00',
    });

    const turno = await facade.abrirTurno(
      TEST_IDS.cajero1,
      TEST_IDS.caja1,
      '15000.00',
    );

    const movIngreso = await facade.registrarMovimiento({
      idTurno: turno.id_turno,
      idUsuario: TEST_IDS.cajero1,
      rolUsuario: 'CAJERO',
      codigoMetodoPago: 'EFECTIVO',
      tipoMovimiento: 'INGRESO',
      montoOperacion: '47530.00',
      conceptoDescripcion: 'Ventas turno tarde',
      origenCarga: 'MANUAL',
    });

    await facade.registrarMovimiento({
      idTurno: turno.id_turno,
      idUsuario: TEST_IDS.cajero1,
      rolUsuario: 'CAJERO',
      codigoMetodoPago: 'QR_TRANSFERENCIA',
      tipoMovimiento: 'INGRESO',
      montoOperacion: '48200.00',
      conceptoDescripcion: 'Cobros QR',
      origenCarga: 'MANUAL',
    });

    // Esperado efectivo: 15000 + 47530 = 62530.00; contado = 62500.00 -> -$30 absorbido por margen $100
    const arqueo = await facade.cerrarTurno({
      idTurno: turno.id_turno,
      idUsuarioCierre: TEST_IDS.cajero1,
      rolUsuario: 'CAJERO',
      efectivoDeclarado: '62500.00',
      observacionesCierre: 'Sin novedad en billetes',
    });

    expect(arqueo.multiplo_redondeo_aplicado).toBe('100.00');
    expect(arqueo.total_esperado_general).toBe('110730.00');
    expect(arqueo.total_declarado_general).toBe('110700.00');
    expect(arqueo.ajuste_redondeo_total).toBe('-30.00');
    expect(arqueo.diferencia_real_total).toBe('0.00');
    expect(arqueo.estado_resultado).toBe('DENTRO_TOLERANCIA');
    expect(arqueo.alerta_posible_reclamo_cliente).toBe(false);
    expect(arqueo.detalles).toHaveLength(3);

    const qrDetalle = arqueo.detalles.find(
      (d) => d.codigo_metodo === 'QR_TRANSFERENCIA',
    );
    expect(qrDetalle?.monto_declarado).toBe('48200.00');
    expect(qrDetalle?.ajuste_redondeo).toBe('0.00');

    // Bloqueo post-cierre (RN-05): no permite nuevos movimientos, anulaciones ni recierre
    await expect(
      facade.registrarMovimiento({
        idTurno: turno.id_turno,
        idUsuario: TEST_IDS.cajero1,
        rolUsuario: 'CAJERO',
        codigoMetodoPago: 'EFECTIVO',
        tipoMovimiento: 'INGRESO',
        montoOperacion: '1000.00',
        conceptoDescripcion: 'Intento post cierre',
        origenCarga: 'MANUAL',
      }),
    ).rejects.toThrow(TurnoCerradoError);

    await expect(
      facade.anularMovimiento({
        idMovimiento: movIngreso.movimiento.id_movimiento,
        idUsuarioEncargado: TEST_IDS.encargado,
        motivoAnulacion: 'Intento post cierre',
      }),
    ).rejects.toThrow(TurnoCerradoError);

    await expect(
      facade.cerrarTurno({
        idTurno: turno.id_turno,
        idUsuarioCierre: TEST_IDS.cajero1,
        rolUsuario: 'CAJERO',
        efectivoDeclarado: '62500.00',
      }),
    ).rejects.toThrow(TurnoCerradoError);

    // La caja física y el operador quedan libres para abrir un nuevo turno
    const nuevoTurno = await facade.abrirTurno(
      TEST_IDS.cajero1,
      TEST_IDS.caja1,
      '10000.00',
    );
    expect(nuevoTurno.estado_turno).toBe('ABIERTO');

    // Foto histórica inmutable (RN-04): cambiar la config después no altera el arqueo ya emitido
    await facade.configurarRedondeo({
      idUsuarioEncargado: TEST_IDS.encargado,
      multiploRedondeoEfectivo: '0.00',
    });
    const arqueoConsultado = await facade.obtenerArqueoPorId(arqueo.id_arqueo, {
      idUsuario: TEST_IDS.cajero1,
      rolUsuario: 'CAJERO',
    });
    expect(arqueoConsultado.multiplo_redondeo_aplicado).toBe('100.00');
    expect(arqueoConsultado.ajuste_redondeo_total).toBe('-30.00');
  });

  it('cierra con cuadre perfecto, sobrante con alerta de reclamo y faltante >= margen', async () => {
    const ctx = crearContextoEnMemoria();
    const facade = new CajaFacade(ctx);

    await facade.configurarRedondeo({
      idUsuarioEncargado: TEST_IDS.encargado,
      multiploRedondeoEfectivo: '500.00',
    });

    // 1) Cuadre perfecto
    const t1 = await facade.abrirTurno(TEST_IDS.cajero1, TEST_IDS.caja1, '10000.00');
    const a1 = await facade.cerrarTurno({
      idTurno: t1.id_turno,
      idUsuarioCierre: TEST_IDS.cajero1,
      rolUsuario: 'CAJERO',
      efectivoDeclarado: '10000.00',
    });
    expect(a1.estado_resultado).toBe('CUADRE_PERFECTO');
    expect(a1.alerta_posible_reclamo_cliente).toBe(false);

    // 2) Sobrante > margen ($500) -> alerta posible reclamo cliente (RN-07)
    const t2 = await facade.abrirTurno(TEST_IDS.cajero1, TEST_IDS.caja1, '10000.00');
    const a2 = await facade.cerrarTurno({
      idTurno: t2.id_turno,
      idUsuarioCierre: TEST_IDS.cajero1,
      rolUsuario: 'CAJERO',
      efectivoDeclarado: '12500.00',
    });
    expect(a2.estado_resultado).toBe('SOBRANTE');
    expect(a2.diferencia_real_total).toBe('2500.00');
    expect(a2.alerta_posible_reclamo_cliente).toBe(true);

    // 3) Faltante >= margen (-$500) -> imputado como FALTANTE real
    const t3 = await facade.abrirTurno(TEST_IDS.cajero1, TEST_IDS.caja1, '10000.00');
    const a3 = await facade.cerrarTurno({
      idTurno: t3.id_turno,
      idUsuarioCierre: TEST_IDS.cajero1,
      rolUsuario: 'CAJERO',
      efectivoDeclarado: '9500.00',
    });
    expect(a3.estado_resultado).toBe('FALTANTE');
    expect(a3.ajuste_redondeo_total).toBe('0.00');
    expect(a3.diferencia_real_total).toBe('-500.00');
  });

  it('rechaza efectivo negativo (RN-06) y que un CAJERO cierre o consulte arqueos de otro operador (RN-08)', async () => {
    const ctx = crearContextoEnMemoria();
    const facade = new CajaFacade(ctx);

    const turno = await facade.abrirTurno(
      TEST_IDS.cajero1,
      TEST_IDS.caja1,
      '10000.00',
    );

    await expect(
      facade.cerrarTurno({
        idTurno: turno.id_turno,
        idUsuarioCierre: TEST_IDS.cajero1,
        rolUsuario: 'CAJERO',
        efectivoDeclarado: '-100.00',
      }),
    ).rejects.toThrow(MontoInvalidoError);

    await expect(
      facade.cerrarTurno({
        idTurno: turno.id_turno,
        idUsuarioCierre: TEST_IDS.cajero2,
        rolUsuario: 'CAJERO',
        efectivoDeclarado: '10000.00',
      }),
    ).rejects.toThrow(RolNoAutorizadoError);

    const arqueo = await facade.cerrarTurno({
      idTurno: turno.id_turno,
      idUsuarioCierre: TEST_IDS.cajero1,
      rolUsuario: 'CAJERO',
      efectivoDeclarado: '10000.00',
    });

    await expect(
      facade.obtenerArqueoPorId(arqueo.id_arqueo, {
        idUsuario: TEST_IDS.cajero2,
        rolUsuario: 'CAJERO',
      }),
    ).rejects.toThrow(RolNoAutorizadoError);
  });
});
