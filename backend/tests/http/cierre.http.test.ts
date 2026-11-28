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

describe('API REST · Arqueo y Cierre en 1 Clic (Issue #6 · RN-03, RN-04, RN-05, RN-07)', () => {
  it('ejecuta cierre atómico (201), expone comprobante (200), bloquea post-cierre (409) y libera la caja', async () => {
    const app = crearAppDePrueba();

    const loginC1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { id_usuario: TEST_IDS.cajero1, pin: '1234' },
    });
    const tokenC1 = (loginC1.json() as { token: string }).token;

    const loginC2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { id_usuario: TEST_IDS.cajero2, pin: '4321' },
    });
    const tokenC2 = (loginC2.json() as { token: string }).token;

    const loginEnc = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { id_usuario: TEST_IDS.encargado, pin: '5678' },
    });
    const tokenEnc = (loginEnc.json() as { token: string }).token;

    // Configurar margen de tolerancia $100
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/configuracion/caja',
      headers: { authorization: `Bearer ${tokenEnc}` },
      payload: { multiplo_redondeo_efectivo: '100.00' },
    });

    // Abrir turno en Caja #1 con fondo $15.000
    const apertura = await app.inject({
      method: 'POST',
      url: '/api/v1/turnos/abrir',
      headers: { authorization: `Bearer ${tokenC1}` },
      payload: { id_caja: TEST_IDS.caja1, fondo_inicial_efectivo: '15000.00' },
    });
    const idTurno = apertura.json().turno.id_turno as string;

    // Registrar movimiento en efectivo y QR
    await app.inject({
      method: 'POST',
      url: `/api/v1/turnos/${idTurno}/movimientos`,
      headers: { authorization: `Bearer ${tokenC1}` },
      payload: {
        tipo_movimiento: 'INGRESO',
        codigo_metodo_pago: 'EFECTIVO',
        monto_operacion: '47530.00',
        concepto_descripcion: 'Ventas efectivo',
      },
    });

    await app.inject({
      method: 'POST',
      url: `/api/v1/turnos/${idTurno}/movimientos`,
      headers: { authorization: `Bearer ${tokenC1}` },
      payload: {
        tipo_movimiento: 'INGRESO',
        codigo_metodo_pago: 'QR_TRANSFERENCIA',
        monto_operacion: '31000.00',
        concepto_descripcion: 'Ventas QR',
      },
    });

    // Efectivo negativo -> HTTP 400
    const cierreNegativo = await app.inject({
      method: 'POST',
      url: `/api/v1/turnos/${idTurno}/cerrar`,
      headers: { authorization: `Bearer ${tokenC1}` },
      payload: { efectivo_declarado: '-10.00' },
    });
    expect(cierreNegativo.statusCode).toBe(400);

    // Otro cajero intentando cerrar caja ajena -> HTTP 403
    const cierreAjeno = await app.inject({
      method: 'POST',
      url: `/api/v1/turnos/${idTurno}/cerrar`,
      headers: { authorization: `Bearer ${tokenC2}` },
      payload: { efectivo_declarado: '62500.00' },
    });
    expect(cierreAjeno.statusCode).toBe(403);

    // Cierre válido con -$30 dentro de tolerancia $100 -> HTTP 201
    const cierreOk = await app.inject({
      method: 'POST',
      url: `/api/v1/turnos/${idTurno}/cerrar`,
      headers: { authorization: `Bearer ${tokenC1}` },
      payload: {
        efectivo_declarado: '62500.00',
        observaciones_cierre: 'Todo en orden',
      },
    });
    expect(cierreOk.statusCode).toBe(201);
    const { arqueo } = cierreOk.json();
    expect(arqueo.estado_resultado).toBe('DENTRO_TOLERANCIA');
    expect(arqueo.ajuste_redondeo_total).toBe('-30.00');
    expect(arqueo.diferencia_real_total).toBe('0.00');
    expect(arqueo.multiplo_redondeo_aplicado).toBe('100.00');

    // Consulta del comprobante por dueño (200), encargado (200) y otro cajero (403)
    const getDueno = await app.inject({
      method: 'GET',
      url: `/api/v1/arqueos/${arqueo.id_arqueo}`,
      headers: { authorization: `Bearer ${tokenC1}` },
    });
    expect(getDueno.statusCode).toBe(200);

    const getEncargado = await app.inject({
      method: 'GET',
      url: `/api/v1/arqueos/${arqueo.id_arqueo}`,
      headers: { authorization: `Bearer ${tokenEnc}` },
    });
    expect(getEncargado.statusCode).toBe(200);

    const getAjeno = await app.inject({
      method: 'GET',
      url: `/api/v1/arqueos/${arqueo.id_arqueo}`,
      headers: { authorization: `Bearer ${tokenC2}` },
    });
    expect(getAjeno.statusCode).toBe(403);

    // Post-cierre bloqueado (409 TURNO_CERRADO)
    const movPostCierre = await app.inject({
      method: 'POST',
      url: `/api/v1/turnos/${idTurno}/movimientos`,
      headers: { authorization: `Bearer ${tokenC1}` },
      payload: {
        tipo_movimiento: 'INGRESO',
        codigo_metodo_pago: 'EFECTIVO',
        monto_operacion: '500.00',
      },
    });
    expect(movPostCierre.statusCode).toBe(409);
    expect(movPostCierre.json().codigo).toBe('TURNO_CERRADO');

    const recierre = await app.inject({
      method: 'POST',
      url: `/api/v1/turnos/${idTurno}/cerrar`,
      headers: { authorization: `Bearer ${tokenC1}` },
      payload: { efectivo_declarado: '62500.00' },
    });
    expect(recierre.statusCode).toBe(409);
    expect(recierre.json().codigo).toBe('TURNO_CERRADO');

    // Caja #1 vuelve a estar libre para un nuevo turno (201)
    const reapertura = await app.inject({
      method: 'POST',
      url: '/api/v1/turnos/abrir',
      headers: { authorization: `Bearer ${tokenC1}` },
      payload: { id_caja: TEST_IDS.caja1, fondo_inicial_efectivo: '10000.00' },
    });
    expect(reapertura.statusCode).toBe(201);
  });
});
