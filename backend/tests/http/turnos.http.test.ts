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

describe('API REST · Multi-Caja, Auth PIN y Permisos por Rol (Issue #2)', () => {
  it('expone operadores activos sin pin_acceso_hash y rechaza PIN inválido con 401', async () => {
    const app = crearAppDePrueba();
    const ops = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/operadores',
    });

    expect(ops.statusCode).toBe(200);
    expect(ops.json().operadores).toHaveLength(3);
    expect(ops.json().operadores[0]).not.toHaveProperty('pin_acceso_hash');

    const fail = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { id_usuario: TEST_IDS.cajero1, pin: '9999' },
    });
    expect(fail.statusCode).toBe(401);
  });

  it('permite 2 cajas abiertas en paralelo, bloquea caja ocupada/doble turno y restringe /turnos/activos al ENCARGADO', async () => {
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

    // Fondo negativo rechazado (RN-06)
    const negativo = await app.inject({
      method: 'POST',
      url: '/api/v1/turnos/abrir',
      headers: { authorization: `Bearer ${tokenC1}` },
      payload: { id_caja: TEST_IDS.caja1, fondo_inicial_efectivo: '-50.00' },
    });
    expect(negativo.statusCode).toBe(400);

    // Cajero 1 abre Caja 1
    const apertura1 = await app.inject({
      method: 'POST',
      url: '/api/v1/turnos/abrir',
      headers: { authorization: `Bearer ${tokenC1}` },
      payload: { id_caja: TEST_IDS.caja1, fondo_inicial_efectivo: '15000.00' },
    });
    expect(apertura1.statusCode).toBe(201);
    expect(apertura1.json().turno.caja.numero_caja).toBe(1);

    // Cajero 2 intenta abrir la misma Caja 1 -> 409 CAJA_OCUPADA
    const cajaOcupada = await app.inject({
      method: 'POST',
      url: '/api/v1/turnos/abrir',
      headers: { authorization: `Bearer ${tokenC2}` },
      payload: { id_caja: TEST_IDS.caja1, fondo_inicial_efectivo: '10000.00' },
    });
    expect(cajaOcupada.statusCode).toBe(409);
    expect(cajaOcupada.json().codigo).toBe('CAJA_OCUPADA');

    // Cajero 1 intenta abrir Caja 2 teniendo Caja 1 abierta -> 409 TURNO_YA_ABIERTO
    const dobleTurno = await app.inject({
      method: 'POST',
      url: '/api/v1/turnos/abrir',
      headers: { authorization: `Bearer ${tokenC1}` },
      payload: { id_caja: TEST_IDS.caja2, fondo_inicial_efectivo: '10000.00' },
    });
    expect(dobleTurno.statusCode).toBe(409);
    expect(dobleTurno.json().codigo).toBe('TURNO_YA_ABIERTO');

    // Cajero 2 abre Caja 2 en paralelo -> 201 OK
    const apertura2 = await app.inject({
      method: 'POST',
      url: '/api/v1/turnos/abrir',
      headers: { authorization: `Bearer ${tokenC2}` },
      payload: { id_caja: TEST_IDS.caja2, fondo_inicial_efectivo: '20000.00' },
    });
    expect(apertura2.statusCode).toBe(201);
    expect(apertura2.json().turno.caja.numero_caja).toBe(2);

    // CAJERO no puede listar todos los turnos activos (RN-08 -> 403)
    const activosCajero = await app.inject({
      method: 'GET',
      url: '/api/v1/turnos/activos',
      headers: { authorization: `Bearer ${tokenC1}` },
    });
    expect(activosCajero.statusCode).toBe(403);

    // ENCARGADO sí ve los 2 turnos activos + 4 cajas con estado en vivo
    const activosEnc = await app.inject({
      method: 'GET',
      url: '/api/v1/turnos/activos',
      headers: { authorization: `Bearer ${tokenEnc}` },
    });
    expect(activosEnc.statusCode).toBe(200);
    expect(activosEnc.json().turnos).toHaveLength(2);
    expect(activosEnc.json().cajas).toHaveLength(4);
  });
});
