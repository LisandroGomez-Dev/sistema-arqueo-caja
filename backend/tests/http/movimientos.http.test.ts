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

describe('API REST · Movimientos y Libro Diario en Vivo (Issue #3)', () => {
  it('registra ingresos/egresos, actualiza subtotales en vivo y devuelve el libro diario', async () => {
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

    const apertura = await app.inject({
      method: 'POST',
      url: '/api/v1/turnos/abrir',
      headers: { authorization: `Bearer ${tokenC1}` },
      payload: { id_caja: TEST_IDS.caja1, fondo_inicial_efectivo: '15000.00' },
    });
    const idTurno = apertura.json().turno.id_turno as string;

    // Egreso sin concepto -> 400 CONCEPTO_OBLIGATORIO
    const egresoSinConcepto = await app.inject({
      method: 'POST',
      url: `/api/v1/turnos/${idTurno}/movimientos`,
      headers: { authorization: `Bearer ${tokenC1}` },
      payload: {
        tipo_movimiento: 'EGRESO',
        codigo_metodo_pago: 'EFECTIVO',
        monto_operacion: '5000.00',
      },
    });
    expect(egresoSinConcepto.statusCode).toBe(400);
    expect(egresoSinConcepto.json().codigo).toBe('CONCEPTO_OBLIGATORIO');

    // Ingreso en efectivo -> 201 + efectivo sube a 27500.00
    const ingreso = await app.inject({
      method: 'POST',
      url: `/api/v1/turnos/${idTurno}/movimientos`,
      headers: { authorization: `Bearer ${tokenC1}` },
      payload: {
        tipo_movimiento: 'INGRESO',
        codigo_metodo_pago: 'EFECTIVO',
        monto_operacion: '12500.00',
        concepto_descripcion: 'Venta mostrador',
      },
    });
    expect(ingreso.statusCode).toBe(201);
    const efecDespuesIngreso = ingreso
      .json()
      .turno.subtotales_por_metodo.find(
        (m: { codigo_metodo: string }) => m.codigo_metodo === 'EFECTIVO',
      );
    expect(efecDespuesIngreso.monto_esperado).toBe('27500.00');

    // Otro cajero intenta registrar en Caja 1 -> 403
    const ajeno = await app.inject({
      method: 'POST',
      url: `/api/v1/turnos/${idTurno}/movimientos`,
      headers: { authorization: `Bearer ${tokenC2}` },
      payload: {
        tipo_movimiento: 'INGRESO',
        codigo_metodo_pago: 'TARJETA',
        monto_operacion: '3000.00',
      },
    });
    expect(ajeno.statusCode).toBe(403);

    // Listar libro diario
    const lista = await app.inject({
      method: 'GET',
      url: `/api/v1/turnos/${idTurno}/movimientos`,
      headers: { authorization: `Bearer ${tokenC1}` },
    });
    expect(lista.statusCode).toBe(200);
    expect(lista.json().movimientos).toHaveLength(1);
    expect(lista.json().movimientos[0].origen_carga).toBe('MANUAL');
  });
});
