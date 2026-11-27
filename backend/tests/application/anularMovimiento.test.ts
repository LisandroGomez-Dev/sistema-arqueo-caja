import { describe, expect, it } from 'vitest';
import { CajaFacade } from '../../src/application/facade/CajaFacade.js';
import {
  ConceptoObligatorioError,
  MontoInvalidoError,
  MotivoAnulacionObligatorioError,
  MovimientoYaAnuladoError,
  RolNoAutorizadoError,
  TurnoCerradoError,
} from '../../src/domain/errors/DominioError.js';
import { EstadoTurnoCerrado } from '../../src/domain/state/EstadoTurnoCerrado.js';
import {
  crearContextoEnMemoria,
  TEST_IDS,
} from '../helpers/inMemoryAdapters.js';

describe('CajaFacade · Anulación Lógica de Movimientos (Issue #4 · RN-01, RN-05, RN-08)', () => {
  it('anula un INGRESO y un EGRESO recalculando subtotales con exactitud sin borrar registros', async () => {
    const ctx = crearContextoEnMemoria();
    const facade = new CajaFacade(ctx);
    const turno = await facade.abrirTurno(TEST_IDS.cajero1, TEST_IDS.caja1, '15000.00');

    const ingreso = await facade.registrarMovimiento({
      idTurno: turno.id_turno,
      idUsuario: TEST_IDS.cajero1,
      rolUsuario: 'CAJERO',
      codigoMetodoPago: 'EFECTIVO',
      tipoMovimiento: 'INGRESO',
      montoOperacion: '5000.50',
      conceptoDescripcion: 'Venta duplicada',
      origenCarga: 'MANUAL',
    });

    const egreso = await facade.registrarMovimiento({
      idTurno: turno.id_turno,
      idUsuario: TEST_IDS.cajero1,
      rolUsuario: 'CAJERO',
      codigoMetodoPago: 'EFECTIVO',
      tipoMovimiento: 'EGRESO',
      montoOperacion: '2000.25',
      conceptoDescripcion: 'Proveedor erróneo',
      origenCarga: 'MANUAL',
    });

    // Efectivo acumulado antes de anular: 15000 + 5000.50 - 2000.25 = 18000.25
    const efecAntes = egreso.turno.subtotales_por_metodo.find(
      (m) => m.codigo_metodo === 'EFECTIVO',
    );
    expect(efecAntes?.monto_esperado).toBe('18000.25');

    // Encargado anula el ingreso -> efectivo baja a 12999.75
    const trasAnularIngreso = await facade.anularMovimiento({
      idMovimiento: ingreso.movimiento.id_movimiento,
      idUsuarioEncargado: TEST_IDS.encargado,
      motivoAnulacion: 'Monto duplicado en mostrador',
    });
    expect(trasAnularIngreso.movimiento.estado_movimiento).toBe('ANULADO');
    expect(trasAnularIngreso.movimiento.motivo_anulacion).toBe(
      'Monto duplicado en mostrador',
    );
    expect(trasAnularIngreso.movimiento.usuario_anulacion?.nombre_completo).toBe(
      'Martín Ruiz',
    );
    const efecTrasIngreso = trasAnularIngreso.turno.subtotales_por_metodo.find(
      (m) => m.codigo_metodo === 'EFECTIVO',
    );
    expect(efecTrasIngreso?.monto_esperado).toBe('12999.75');

    // Encargado anula el egreso -> efectivo vuelve a 15000.00
    const trasAnularEgreso = await facade.anularMovimiento({
      idMovimiento: egreso.movimiento.id_movimiento,
      idUsuarioEncargado: TEST_IDS.encargado,
      motivoAnulacion: 'Se cargó en caja equivocada',
    });
    const efecTrasEgreso = trasAnularEgreso.turno.subtotales_por_metodo.find(
      (m) => m.codigo_metodo === 'EFECTIVO',
    );
    expect(efecTrasEgreso?.monto_esperado).toBe('15000.00');

    // Inmutabilidad: ambos registros siguen existiendo en el libro diario
    const libro = await facade.listarMovimientosTurno(turno.id_turno, {
      idUsuario: TEST_IDS.encargado,
      rolUsuario: 'ENCARGADO',
    });
    expect(libro).toHaveLength(2);
    expect(libro.every((m) => m.estado_movimiento === 'ANULADO')).toBe(true);
  });

  it('rechaza anulación por CAJERO (RN-08), motivo vacío, doble anulación (RN-01) y turno cerrado (RN-05)', async () => {
    const ctx = crearContextoEnMemoria();
    const facade = new CajaFacade(ctx);
    const turno = await facade.abrirTurno(TEST_IDS.cajero1, TEST_IDS.caja1, '10000.00');

    const mov = await facade.registrarMovimiento({
      idTurno: turno.id_turno,
      idUsuario: TEST_IDS.cajero1,
      rolUsuario: 'CAJERO',
      codigoMetodoPago: 'QR_TRANSFERENCIA',
      tipoMovimiento: 'INGRESO',
      montoOperacion: '4000.00',
      conceptoDescripcion: 'Cobro QR',
      origenCarga: 'MANUAL',
    });

    await expect(
      facade.anularMovimiento({
        idMovimiento: mov.movimiento.id_movimiento,
        idUsuarioEncargado: TEST_IDS.cajero1,
        motivoAnulacion: 'Intento cajero',
      }),
    ).rejects.toThrow(RolNoAutorizadoError);

    await expect(
      facade.anularMovimiento({
        idMovimiento: mov.movimiento.id_movimiento,
        idUsuarioEncargado: TEST_IDS.encargado,
        motivoAnulacion: '  ',
      }),
    ).rejects.toThrow(MotivoAnulacionObligatorioError);

    await facade.anularMovimiento({
      idMovimiento: mov.movimiento.id_movimiento,
      idUsuarioEncargado: TEST_IDS.encargado,
      motivoAnulacion: 'Error de método',
    });

    await expect(
      facade.anularMovimiento({
        idMovimiento: mov.movimiento.id_movimiento,
        idUsuarioEncargado: TEST_IDS.encargado,
        motivoAnulacion: 'Doble anulación',
      }),
    ).rejects.toThrow(MovimientoYaAnuladoError);

    // Nuevo movimiento activo en turno cerrado -> TurnoCerradoError (RN-05)
    const mov2 = await facade.registrarMovimiento({
      idTurno: turno.id_turno,
      idUsuario: TEST_IDS.cajero1,
      rolUsuario: 'CAJERO',
      codigoMetodoPago: 'EFECTIVO',
      tipoMovimiento: 'INGRESO',
      montoOperacion: '1000.00',
      conceptoDescripcion: 'Venta válida',
      origenCarga: 'MANUAL',
    });

    const entidadTurno = await ctx.turnoRepo.buscarPorId(turno.id_turno);
    entidadTurno!.cambiarEstado(new EstadoTurnoCerrado());

    await expect(
      facade.anularMovimiento({
        idMovimiento: mov2.movimiento.id_movimiento,
        idUsuarioEncargado: TEST_IDS.encargado,
        motivoAnulacion: 'Post cierre',
      }),
    ).rejects.toThrow(TurnoCerradoError);
  });

  it('anula y reemplaza en el mismo método conservando el asiento erróneo intacto (RN-01)', async () => {
    const ctx = crearContextoEnMemoria();
    const facade = new CajaFacade(ctx);
    const turno = await facade.abrirTurno(TEST_IDS.cajero1, TEST_IDS.caja1, '10000.00');

    const movErroneo = await facade.registrarMovimiento({
      idTurno: turno.id_turno,
      idUsuario: TEST_IDS.cajero1,
      rolUsuario: 'CAJERO',
      codigoMetodoPago: 'EFECTIVO',
      tipoMovimiento: 'INGRESO',
      montoOperacion: '56000.00',
      conceptoDescripcion: 'Venta mostrador',
      origenCarga: 'MANUAL',
    });

    const resultado = await facade.anularMovimiento({
      idMovimiento: movErroneo.movimiento.id_movimiento,
      idUsuarioEncargado: TEST_IDS.encargado,
      motivoAnulacion: 'Error de tipeo, sobró un cero',
      reemplazo: {
        montoOperacion: '5600.00',
        conceptoDescripcion: 'Venta mostrador corregida',
      },
    });

    // El asiento original queda ANULADO con su monto histórico intacto
    expect(resultado.movimiento.estado_movimiento).toBe('ANULADO');
    expect(resultado.movimiento.monto_operacion).toBe('56000.00');
    expect(resultado.movimiento.usuario_anulacion?.nombre_completo).toBe('Martín Ruiz');

    // El movimiento corregido queda ACTIVO con el encargado como usuario de registro
    expect(resultado.movimiento_reemplazo).not.toBeNull();
    expect(resultado.movimiento_reemplazo?.estado_movimiento).toBe('ACTIVO');
    expect(resultado.movimiento_reemplazo?.monto_operacion).toBe('5600.00');
    expect(resultado.movimiento_reemplazo?.metodo_pago.codigo_metodo).toBe('EFECTIVO');
    expect(resultado.movimiento_reemplazo?.usuario_registro.nombre_completo).toBe(
      'Martín Ruiz',
    );

    // Efectivo esperado: 10000 - 56000 (anulado) + 5600 (real) = 15600.00
    const efectivo = resultado.turno.subtotales_por_metodo.find(
      (m) => m.codigo_metodo === 'EFECTIVO',
    );
    expect(efectivo?.monto_esperado).toBe('15600.00');

    // Libro diario conserva ambos asientos en orden cronológico descendente
    const libro = await facade.listarMovimientosTurno(turno.id_turno, {
      idUsuario: TEST_IDS.encargado,
      rolUsuario: 'ENCARGADO',
    });
    expect(libro).toHaveLength(2);
    expect(libro[0]?.id_movimiento).toBe(resultado.movimiento_reemplazo?.id_movimiento);
    expect(libro[1]?.estado_movimiento).toBe('ANULADO');
  });

  it('anula y reemplaza cambiando método de pago (EFECTIVO -> QR_TRANSFERENCIA) y recalcula ambos canales', async () => {
    const ctx = crearContextoEnMemoria();
    const facade = new CajaFacade(ctx);
    const turno = await facade.abrirTurno(TEST_IDS.cajero1, TEST_IDS.caja1, '10000.00');

    const cobro = await facade.registrarMovimiento({
      idTurno: turno.id_turno,
      idUsuario: TEST_IDS.cajero1,
      rolUsuario: 'CAJERO',
      codigoMetodoPago: 'EFECTIVO',
      tipoMovimiento: 'INGRESO',
      montoOperacion: '8500.00',
      conceptoDescripcion: 'Compra mayorista',
      origenCarga: 'MANUAL',
    });

    const resultado = await facade.anularMovimiento({
      idMovimiento: cobro.movimiento.id_movimiento,
      idUsuarioEncargado: TEST_IDS.encargado,
      motivoAnulacion: 'Pagó con QR, no en efectivo',
      reemplazo: {
        codigoMetodoPago: 'QR_TRANSFERENCIA',
        montoOperacion: '8500.00',
      },
    });

    const efectivo = resultado.turno.subtotales_por_metodo.find(
      (m) => m.codigo_metodo === 'EFECTIVO',
    );
    const qr = resultado.turno.subtotales_por_metodo.find(
      (m) => m.codigo_metodo === 'QR_TRANSFERENCIA',
    );
    expect(efectivo?.monto_esperado).toBe('10000.00');
    expect(qr?.monto_esperado).toBe('8500.00');
    expect(resultado.movimiento_reemplazo?.concepto_descripcion).toBe('Compra mayorista');
  });

  it('rechaza reemplazo inválido (RN-06) dejando intacto el movimiento original', async () => {
    const ctx = crearContextoEnMemoria();
    const facade = new CajaFacade(ctx);
    const turno = await facade.abrirTurno(TEST_IDS.cajero1, TEST_IDS.caja1, '5000.00');

    const mov = await facade.registrarMovimiento({
      idTurno: turno.id_turno,
      idUsuario: TEST_IDS.cajero1,
      rolUsuario: 'CAJERO',
      codigoMetodoPago: 'EFECTIVO',
      tipoMovimiento: 'EGRESO',
      montoOperacion: '1200.00',
      conceptoDescripcion: 'Flete',
      origenCarga: 'MANUAL',
    });

    await expect(
      facade.anularMovimiento({
        idMovimiento: mov.movimiento.id_movimiento,
        idUsuarioEncargado: TEST_IDS.encargado,
        motivoAnulacion: 'Importe incorrecto',
        reemplazo: {
          montoOperacion: '0.00',
        },
      }),
    ).rejects.toThrow(MontoInvalidoError);

    await expect(
      facade.anularMovimiento({
        idMovimiento: mov.movimiento.id_movimiento,
        idUsuarioEncargado: TEST_IDS.encargado,
        motivoAnulacion: 'Falta concepto',
        reemplazo: {
          tipoMovimiento: 'EGRESO',
          montoOperacion: '900.00',
          conceptoDescripcion: '   ',
        },
      }),
    ).rejects.toThrow(ConceptoObligatorioError);

    // El movimiento original debe seguir ACTIVO y sin duplicados en el libro
    const entidadOriginal = await ctx.movimientoRepo.buscarPorId(
      mov.movimiento.id_movimiento,
    );
    expect(entidadOriginal?.estaActivo()).toBe(true);
    expect(ctx.movimientoRepo.movimientos).toHaveLength(1);
  });
});
