import { describe, expect, it } from 'vitest';
import { MovimientoCaja } from '../../src/domain/entities/MovimientoCaja.js';
import {
  ConceptoObligatorioError,
  MontoInvalidoError,
} from '../../src/domain/errors/DominioError.js';
import { Dinero } from '../../src/domain/value-objects/Dinero.js';

describe('Entidad MovimientoCaja (RN-01, RN-06)', () => {
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
});
