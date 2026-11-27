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

describe('API REST · Configuración de Redondeo / Tolerancia (Issue #5 · RF-09)', () => {
  it('permite GET a CAJERO y ENCARGADO, bloquea PATCH a CAJERO (403), valida negativos (400) y actualiza con ENCARGADO (200)', async () => {
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

    // 1) GET accesible para ambos roles
    const getCajero = await app.inject({
      method: 'GET',
      url: '/api/v1/configuracion/caja',
      headers: { authorization: `Bearer ${tokenC1}` },
    });
    expect(getCajero.statusCode).toBe(200);
    expect(getCajero.json().configuracion.multiplo_redondeo_efectivo).toBe(
      '0.00',
    );

    // 2) PATCH bloqueado para CAJERO -> HTTP 403
    const patchCajero = await app.inject({
      method: 'PATCH',
      url: '/api/v1/configuracion/caja',
      headers: { authorization: `Bearer ${tokenC1}` },
      payload: { multiplo_redondeo_efectivo: '100.00' },
    });
    expect(patchCajero.statusCode).toBe(403);

    // 3) PATCH con valor negativo o formato inválido -> HTTP 400
    const patchNegativo = await app.inject({
      method: 'PATCH',
      url: '/api/v1/configuracion/caja',
      headers: { authorization: `Bearer ${tokenEnc}` },
      payload: { multiplo_redondeo_efectivo: '-50.00' },
    });
    expect(patchNegativo.statusCode).toBe(400);

    const patchFormatoInvalido = await app.inject({
      method: 'PATCH',
      url: '/api/v1/configuracion/caja',
      headers: { authorization: `Bearer ${tokenEnc}` },
      payload: { multiplo_redondeo_efectivo: 'cien' },
    });
    expect(patchFormatoInvalido.statusCode).toBe(400);

    // 4) PATCH válido por ENCARGADO -> HTTP 200 y visible en GET /configuracion/caja y /auth/operadores
    const patchOk = await app.inject({
      method: 'PATCH',
      url: '/api/v1/configuracion/caja',
      headers: { authorization: `Bearer ${tokenEnc}` },
      payload: { multiplo_redondeo_efectivo: '500.00' },
    });
    expect(patchOk.statusCode).toBe(200);
    expect(patchOk.json().configuracion.multiplo_redondeo_efectivo).toBe(
      '500.00',
    );
    expect(patchOk.json().configuracion.usuario_actualizacion.nombre_completo).toBe(
      'Martín Ruiz',
    );

    const getLuego = await app.inject({
      method: 'GET',
      url: '/api/v1/configuracion/caja',
      headers: { authorization: `Bearer ${tokenC1}` },
    });
    expect(getLuego.statusCode).toBe(200);
    expect(getLuego.json().configuracion.multiplo_redondeo_efectivo).toBe(
      '500.00',
    );

    const operadores = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/operadores',
    });
    expect(operadores.statusCode).toBe(200);
    expect(operadores.json().comercio.multiplo_redondeo_efectivo).toBe('500.00');
  });
});
