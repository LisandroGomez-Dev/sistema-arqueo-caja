import { describe, expect, it } from 'vitest';
import { CajaFacade } from '../../src/application/facade/CajaFacade.js';
import { buildApp } from '../../src/infrastructure/http/app.js';
import {
  crearContextoEnMemoria,
  TEST_IDS,
} from '../helpers/inMemoryAdapters.js';

function crearAppDePrueba() {
  const cajaFacade = new CajaFacade(crearContextoEnMemoria());
  return buildApp({
    cajaFacade,
    jwtSecret: 'test-jwt-secret-arqueo-caja',
    frontendUrls: ['http://localhost:5173'],
    enableSentry: false,
  });
}

describe('API REST · Anulación Lógica con Rol ENCARGADO (Issue #4)', () => {
  it('bloquea a CAJERO con 403, exige motivo (400), anula con 200 y rechaza doble anulación (409)', async () => {
    const app = crearAppDePrueba();

    const loginC1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { id_usuario: TEST_IDS.cajero1, pin: '1234' },
    });
    const tokenC1 = (loginC1.json() as { token: string }).token;

    const loginEnc = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { id_usuario: TEST_IDS.encargado, pin: '5678' },
    });
    const tokenEnc = (loginEnc.json() as { token: string }).token;

    const apertura = await app.inject({
      method: 'POST',
      url: '/api/v1/turnos/abrir',
      headers: { authorization: `Bearer ${tokenC1}` },
      payload: { id_caja: TEST_IDS.caja1, fondo_inicial_efectivo: '15000.00' },
    });
    const idTurno = apertura.json().turno.id_turno as string;

    const reg = await app.inject({
      method: 'POST',
      url: `/api/v1/turnos/${idTurno}/movimientos`,
      headers: { authorization: `Bearer ${tokenC1}` },
      payload: {
        tipo_movimiento: 'INGRESO',
        codigo_metodo_pago: 'QR_TRANSFERENCIA',
        monto_operacion: '4000.00',
        concepto_descripcion: 'Cobro duplicado QR',
      },
    });
    const idMov = reg.json().movimiento.id_movimiento as string;

    // 1) CAJERO intenta anular -> HTTP 403 (RN-08)
    const intentoCajero = await app.inject({
      method: 'PATCH',
      url: `/api/v1/movimientos/${idMov}/anular`,
      headers: { authorization: `Bearer ${tokenC1}` },
      payload: { motivo_anulacion: 'Me equivoqué' },
    });
    expect(intentoCajero.statusCode).toBe(403);

    // 2) ENCARGADO sin motivo suficiente -> HTTP 400 (RN-01)
    const sinMotivo = await app.inject({
      method: 'PATCH',
      url: `/api/v1/movimientos/${idMov}/anular`,
      headers: { authorization: `Bearer ${tokenEnc}` },
      payload: { motivo_anulacion: 'ab' },
    });
    expect(sinMotivo.statusCode).toBe(400);

    // 3) ENCARGADO anula correctamente -> HTTP 200 + recalcula QR a 0.00
    const anuladoOk = await app.inject({
      method: 'PATCH',
      url: `/api/v1/movimientos/${idMov}/anular`,
      headers: { authorization: `Bearer ${tokenEnc}` },
      payload: { motivo_anulacion: 'Monto duplicado' },
    });
    expect(anuladoOk.statusCode).toBe(200);
    const bodyOk = anuladoOk.json();
    expect(bodyOk.movimiento.estado_movimiento).toBe('ANULADO');
    expect(bodyOk.movimiento_reemplazo).toBeNull();
    expect(bodyOk.movimiento.motivo_anulacion).toBe('Monto duplicado');
    expect(bodyOk.movimiento.usuario_anulacion.nombre_completo).toBe(
      'Martín Ruiz',
    );
    const qrSubtotal = bodyOk.turno.subtotales_por_metodo.find(
      (m: { codigo_metodo: string }) => m.codigo_metodo === 'QR_TRANSFERENCIA',
    );
    expect(qrSubtotal.monto_esperado).toBe('0.00');

    // 4) Segundo intento sobre el mismo movimiento -> HTTP 409 (RN-01)
    const doble = await app.inject({
      method: 'PATCH',
      url: `/api/v1/movimientos/${idMov}/anular`,
      headers: { authorization: `Bearer ${tokenEnc}` },
      payload: { motivo_anulacion: 'Reintento' },
    });
    expect(doble.statusCode).toBe(409);
    expect(doble.json().codigo).toBe('MOVIMIENTO_YA_ANULADO');

    // 5) El movimiento sigue existiendo en el libro diario (prohibido DELETE)
    const libro = await app.inject({
      method: 'GET',
      url: `/api/v1/turnos/${idTurno}/movimientos`,
      headers: { authorization: `Bearer ${tokenEnc}` },
    });
    expect(libro.statusCode).toBe(200);
    expect(libro.json().movimientos).toHaveLength(1);
    expect(libro.json().movimientos[0].estado_movimiento).toBe('ANULADO');
  });

  it('permite anular y reemplazar en una sola petición (200) y rechaza reemplazo inválido (400)', async () => {
    const app = crearAppDePrueba();

    const loginC1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { id_usuario: TEST_IDS.cajero1, pin: '1234' },
    });
    const tokenC1 = (loginC1.json() as { token: string }).token;

    const loginEnc = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { id_usuario: TEST_IDS.encargado, pin: '5678' },
    });
    const tokenEnc = (loginEnc.json() as { token: string }).token;

    const apertura = await app.inject({
      method: 'POST',
      url: '/api/v1/turnos/abrir',
      headers: { authorization: `Bearer ${tokenC1}` },
      payload: { id_caja: TEST_IDS.caja1, fondo_inicial_efectivo: '10000.00' },
    });
    const idTurno = apertura.json().turno.id_turno as string;

    const reg = await app.inject({
      method: 'POST',
      url: `/api/v1/turnos/${idTurno}/movimientos`,
      headers: { authorization: `Bearer ${tokenC1}` },
      payload: {
        tipo_movimiento: 'INGRESO',
        codigo_metodo_pago: 'EFECTIVO',
        monto_operacion: '20000.00',
        concepto_descripcion: 'Venta con devolución parcial',
      },
    });
    const idMov = reg.json().movimiento.id_movimiento as string;

    // Reemplazo con monto 0.00 -> HTTP 400 y movimiento original intacto
    const reemplazoInvalido = await app.inject({
      method: 'PATCH',
      url: `/api/v1/movimientos/${idMov}/anular`,
      headers: { authorization: `Bearer ${tokenEnc}` },
      payload: {
        motivo_anulacion: 'Devolución parcial',
        reemplazo: {
          monto_operacion: '0.00',
        },
      },
    });
    expect(reemplazoInvalido.statusCode).toBe(400);

    // Anulación + reemplazo válido cambiando monto y método -> HTTP 200
    const reemplazoOk = await app.inject({
      method: 'PATCH',
      url: `/api/v1/movimientos/${idMov}/anular`,
      headers: { authorization: `Bearer ${tokenEnc}` },
      payload: {
        motivo_anulacion: 'Pagó por QR monto neto tras devolución',
        reemplazo: {
          tipo_movimiento: 'INGRESO',
          codigo_metodo_pago: 'QR_TRANSFERENCIA',
          monto_operacion: '12500.00',
          concepto_descripcion: 'Venta neta QR',
        },
      },
    });
    expect(reemplazoOk.statusCode).toBe(200);
    const body = reemplazoOk.json();
    expect(body.movimiento.estado_movimiento).toBe('ANULADO');
    expect(body.movimiento.monto_operacion).toBe('20000.00');
    expect(body.movimiento_reemplazo.estado_movimiento).toBe('ACTIVO');
    expect(body.movimiento_reemplazo.monto_operacion).toBe('12500.00');
    expect(body.movimiento_reemplazo.metodo_pago.codigo_metodo).toBe(
      'QR_TRANSFERENCIA',
    );

    const efec = body.turno.subtotales_por_metodo.find(
      (m: { codigo_metodo: string }) => m.codigo_metodo === 'EFECTIVO',
    );
    const qr = body.turno.subtotales_por_metodo.find(
      (m: { codigo_metodo: string }) => m.codigo_metodo === 'QR_TRANSFERENCIA',
    );
    expect(efec.monto_esperado).toBe('10000.00');
    expect(qr.monto_esperado).toBe('12500.00');
  });
});
