import { describe, expect, it } from 'vitest';
import { MetodoPago } from '../../src/domain/entities/MetodoPago.js';
import { TurnoCaja } from '../../src/domain/entities/TurnoCaja.js';
import {
  MontoInvalidoError,
  TurnoCerradoError,
} from '../../src/domain/errors/DominioError.js';
import { EstadoTurnoAbierto } from '../../src/domain/state/EstadoTurnoAbierto.js';
import { EstadoTurnoCerrado } from '../../src/domain/state/EstadoTurnoCerrado.js';
import { Dinero } from '../../src/domain/value-objects/Dinero.js';

describe('Entidad TurnoCaja + Patrón State (RN-02, RN-05, RN-06)', () => {
  it('asigna el fondo inicial exclusivamente a EFECTIVO y $0.00 a canales digitales (RN-02)', () => {
    const turno = new TurnoCaja({
      idTurno: 'turno-1',
      idCaja: 'caja-1',
      idUsuarioApertura: 'user-1',
      fondoInicialEfectivo: Dinero.desde('15000.00'),
      fechaHoraApertura: new Date(),
      fechaHoraCierre: null,
      estado: new EstadoTurnoAbierto(),
    });

    const efectivo = new MetodoPago({
      idMetodoPago: 'm-1',
      codigoMetodo: 'EFECTIVO',
      nombreMetodo: 'Efectivo',
      permiteRedondeo: true,
      estaActivo: true,
    });
    const qr = new MetodoPago({
      idMetodoPago: 'm-2',
      codigoMetodo: 'QR_TRANSFERENCIA',
      nombreMetodo: 'QR / Transferencia',
      permiteRedondeo: false,
      estaActivo: true,
    });
    const tarjeta = new MetodoPago({
      idMetodoPago: 'm-3',
      codigoMetodo: 'TARJETA',
      nombreMetodo: 'Tarjeta',
      permiteRedondeo: false,
      estaActivo: true,
    });

    expect(turno.calcularEsperadoInicialPorMetodo(efectivo).aString()).toBe('15000.00');
    expect(turno.calcularEsperadoInicialPorMetodo(qr).aString()).toBe('0.00');
    expect(turno.calcularEsperadoInicialPorMetodo(tarjeta).aString()).toBe('0.00');
  });

  it('acepta fondo inicial igual a $0.00 y rechaza fondos negativos (RN-06)', () => {
    const turnoCero = new TurnoCaja({
      idTurno: 'turno-0',
      idCaja: 'caja-1',
      idUsuarioApertura: 'user-1',
      fondoInicialEfectivo: Dinero.cero(),
      fechaHoraApertura: new Date(),
      fechaHoraCierre: null,
      estado: new EstadoTurnoAbierto(),
    });

    expect(turnoCero.fondoInicialEfectivo.aString()).toBe('0.00');

    expect(
      () =>
        new TurnoCaja({
          idTurno: 'turno-neg',
          idCaja: 'caja-1',
          idUsuarioApertura: 'user-1',
          fondoInicialEfectivo: Dinero.desde('-1.00'),
          fechaHoraApertura: new Date(),
          fechaHoraCierre: null,
          estado: new EstadoTurnoAbierto(),
        }),
    ).toThrow(MontoInvalidoError);
  });

  it('bloquea operaciones cuando transiciona a EstadoTurnoCerrado (RN-05)', () => {
    const turno = new TurnoCaja({
      idTurno: 'turno-state',
      idCaja: 'caja-1',
      idUsuarioApertura: 'user-1',
      fondoInicialEfectivo: Dinero.desde('10000.00'),
      fechaHoraApertura: new Date(),
      fechaHoraCierre: null,
      estado: new EstadoTurnoAbierto(),
    });

    expect(turno.obtenerCodigoEstado()).toBe('ABIERTO');
    expect(turno.permiteModificaciones()).toBe(true);
    expect(() => turno.validarOperacion()).not.toThrow();

    turno.cambiarEstado(new EstadoTurnoCerrado());
    expect(turno.obtenerCodigoEstado()).toBe('CERRADO');
    expect(turno.permiteModificaciones()).toBe(false);
    expect(() => turno.validarOperacion()).toThrow(TurnoCerradoError);
  });
});
