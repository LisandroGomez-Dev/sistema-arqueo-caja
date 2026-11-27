import { describe, expect, it } from 'vitest';
import { MovimientoCaja } from '../../src/domain/entities/MovimientoCaja.js';
import { Usuario } from '../../src/domain/entities/Usuario.js';
import {
  ConceptoObligatorioError,
  MontoInvalidoError,
  MotivoAnulacionObligatorioError,
  MovimientoYaAnuladoError,
  RolNoAutorizadoError,
} from '../../src/domain/errors/DominioError.js';
import { Dinero } from '../../src/domain/value-objects/Dinero.js';

describe('Entidad MovimientoCaja (RN-01, RN-06, RN-08)', () => {
  const baseProps = {
    idMovimiento: 'mov-1',
    idTurno: 'turno-1',
    idMetodoPago: 'metodo-efec',
    idUsuarioRegistro: 'user-1',
    origenCarga: 'MANUAL' as const,
    urlComprobante: null,
    estadoMovimiento: 'ACTIVO' as const,
    motivoAnulacion: null,
    idUsuarioAnulacion: null,
    fechaHoraAnulacion: null,
    fechaHoraRegistro: new Date(),
  };

  const cajero = new Usuario({
    idUsuario: 'user-1',
    nombreCompleto: 'Lucas Gómez',
    rolUsuario: 'CAJERO',
    estaActivo: true,
    fechaAlta: new Date(),
  });

  const encargado = new Usuario({
    idUsuario: 'user-2',
    nombreCompleto: 'Martín Ruiz',
    rolUsuario: 'ENCARGADO',
    estaActivo: true,
    fechaAlta: new Date(),
  });

  it('permite INGRESO sin concepto y devuelve importe positivo', () => {
    const mov = new MovimientoCaja({
      ...baseProps,
      tipoMovimiento: 'INGRESO',
      montoOperacion: Dinero.desde('12500.50'),
      conceptoDescripcion: null,
    });

    expect(mov.estaActivo()).toBe(true);
    expect(mov.obtenerImporteConSigno().aString()).toBe('12500.50');
  });

  it('exige concepto obligatorio en EGRESO y devuelve importe negativo (RN-06)', () => {
    expect(
      () =>
        new MovimientoCaja({
          ...baseProps,
          tipoMovimiento: 'EGRESO',
          montoOperacion: Dinero.desde('8500.00'),
          conceptoDescripcion: '   ',
        }),
    ).toThrow(ConceptoObligatorioError);

    const egreso = new MovimientoCaja({
      ...baseProps,
      tipoMovimiento: 'EGRESO',
      montoOperacion: Dinero.desde('8500.00'),
      conceptoDescripcion: 'Pago a proveedor de soda',
    });
    expect(egreso.obtenerImporteConSigno().aString()).toBe('-8500.00');
  });

  it('rechaza montos iguales a 0 o negativos (RN-06)', () => {
    expect(
      () =>
        new MovimientoCaja({
          ...baseProps,
          tipoMovimiento: 'INGRESO',
          montoOperacion: Dinero.cero(),
          conceptoDescripcion: 'Cero',
        }),
    ).toThrow(MontoInvalidoError);

    expect(
      () =>
        new MovimientoCaja({
          ...baseProps,
          tipoMovimiento: 'INGRESO',
          montoOperacion: Dinero.desde('-10.00'),
          conceptoDescripcion: 'Negativo',
        }),
    ).toThrow(MontoInvalidoError);
  });

  it('permite anulación lógica por ENCARGADO con motivo y bloquea CAJERO/motivo vacío/doble anulación (RN-01, RN-08)', () => {
    const mov = new MovimientoCaja({
      ...baseProps,
      tipoMovimiento: 'INGRESO',
      montoOperacion: Dinero.desde('4000.00'),
      conceptoDescripcion: 'Error tipeo',
    });

    expect(() => mov.anular('Monto duplicado', cajero)).toThrow(
      RolNoAutorizadoError,
    );
    expect(() => mov.anular('  ', encargado)).toThrow(
      MotivoAnulacionObligatorioError,
    );

    mov.anular('Monto duplicado', encargado);
    expect(mov.estadoMovimiento).toBe('ANULADO');
    expect(mov.estaActivo()).toBe(false);
    expect(mov.motivoAnulacion).toBe('Monto duplicado');
    expect(mov.idUsuarioAnulacion).toBe(encargado.idUsuario);
    expect(mov.fechaHoraAnulacion).not.toBeNull();
    expect(mov.obtenerImporteConSigno().aString()).toBe('0.00');

    expect(() => mov.anular('Otro intento', encargado)).toThrow(
      MovimientoYaAnuladoError,
    );
  });
});
