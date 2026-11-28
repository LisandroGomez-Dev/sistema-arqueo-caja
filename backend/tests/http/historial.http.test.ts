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

describe('API REST · Historial de Cierres y Acumulado Mensual (Issue #7 · RF-05, RN-08)', () => {
  it('bloquea a CAJERO con 403, valida query params (400) y retorna historial + acumulado para ENCARGADO (200)', async () => {
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

    // Configurar margen $100 y generar 1 cierre dentro de tolerancia
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/configuracion/caja',
      headers: { authorization: `Bearer ${tokenEnc}` },
      payload: { multiplo_redondeo_efectivo: '100.00' },
    });

    const apertura = await app.inject({
      method: 'POST',
      url: '/api/v1/turnos/abrir',
      headers: { authorization: `Bearer ${tokenC1}` },
      payload: { id_caja: TEST_IDS.caja1, fondo_inicial_efectivo: '10000.00' },
    });
    const idTurno = apertura.json().turno.id_turno as string;

    await app.inject({
      method: 'POST',
      url: `/api/v1/turnos/${idTurno}/cerrar`,
      headers: { authorization: `Bearer ${tokenC1}` },
      payload: { efectivo_declarado: '9960.00' },
    });

    // 1) CAJERO bloqueado con HTTP 403 (RN-08)
    const intentoCajero = await app.inject({
      method: 'GET',
      url: '/api/v1/arqueos',
      headers: { authorization: `Bearer ${tokenC1}` },
    });
    expect(intentoCajero.statusCode).toBe(403);

    // 2) Validaciones HTTP 400 (mes inválido / rango invertido)
    const mesInvalido = await app.inject({
      method: 'GET',
      url: '/api/v1/arqueos?mes=2026-13',
      headers: { authorization: `Bearer ${tokenEnc}` },
    });
    expect(mesInvalido.statusCode).toBe(400);

    const rangoInvertido = await app.inject({
      method: 'GET',
      url: '/api/v1/arqueos?fecha_desde=2026-11-28&fecha_hasta=2026-11-20',
      headers: { authorization: `Bearer ${tokenEnc}` },
    });
    expect(rangoInvertido.statusCode).toBe(400);

    // 3) Consulta válida de ENCARGADO (200)
    const historialOk = await app.inject({
      method: 'GET',
      url: `/api/v1/arqueos?id_usuario=${TEST_IDS.cajero1}&estado_resultado=DENTRO_TOLERANCIA`,
      headers: { authorization: `Bearer ${tokenEnc}` },
    });
    expect(historialOk.statusCode).toBe(200);
    const body = historialOk.json();
    expect(body.arqueos).toHaveLength(1);
    expect(body.resumen_filtrado.total_ajuste_redondeo).toBe('-40.00');
    expect(body.acumulado_mensual_por_cajero).toHaveLength(1);
    expect(body.acumulado_mensual_por_cajero[0].usuario.nombre_completo).toBe(
      'Lucas Gómez',
    );
    expect(
      body.acumulado_mensual_por_cajero[0].acumulado_ajuste_redondeo,
    ).toBe('-40.00');
  });
});
