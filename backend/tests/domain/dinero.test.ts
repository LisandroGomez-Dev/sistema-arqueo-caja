import { describe, expect, it } from 'vitest';
import { MontoInvalidoError } from '../../src/domain/errors/DominioError.js';
import { Dinero } from '../../src/domain/value-objects/Dinero.js';

describe('Value Object Dinero (RNF-01)', () => {
  it('suma exactamente sin errores de punto flotante binario', () => {
    const a = Dinero.desde('0.10');
    const b = Dinero.desde('0.20');

    expect(a.sumar(b).aString()).toBe('0.30');
  });

  it('normaliza importes enteros o con 1 decimal a 2 decimales', () => {
    expect(Dinero.desde('15000').aString()).toBe('15000.00');
    expect(Dinero.desde('8500.5').aString()).toBe('8500.50');
    expect(Dinero.cero().aString()).toBe('0.00');
  });

  it('detecta valores negativos, cero y positivos', () => {
    expect(Dinero.desde('-0.01').esNegativo()).toBe(true);
    expect(Dinero.desde('0.00').esNegativo()).toBe(false);
    expect(Dinero.desde('0.00').esCero()).toBe(true);
    expect(Dinero.desde('100.00').esPositivo()).toBe(true);
  });

  it('rechaza cadenas vacías o no numéricas con MontoInvalidoError', () => {
    expect(() => Dinero.desde('')).toThrow(MontoInvalidoError);
    expect(() => Dinero.desde('abc')).toThrow(MontoInvalidoError);
    expect(() => Dinero.desde('15.000,00')).toThrow(MontoInvalidoError);
  });
});
