import { describe, expect, it } from 'vitest';
import { ArqueoCierre } from '../../src/domain/entities/ArqueoCierre.js';
import { ConfiguracionCaja } from '../../src/domain/entities/ConfiguracionCaja.js';
import { DetalleArqueoMetodo } from '../../src/domain/entities/DetalleArqueoMetodo.js';
import { MetodoPago } from '../../src/domain/entities/MetodoPago.js';
import { Usuario } from '../../src/domain/entities/Usuario.js';
import {
  MetodoDuplicadoEnArqueoError,
  MontoInvalidoError,
  RolNoAutorizadoError,
} from '../../src/domain/errors/DominioError.js';
import { RedondeoComercialStrategy } from '../../src/domain/strategy/RedondeoComercialStrategy.js';
import { SinRedondeoStrategy } from '../../src/domain/strategy/SinRedondeoStrategy.js';
import { Dinero } from '../../src/domain/value-objects/Dinero.js';

const metodoEfectivo = new MetodoPago({
  idMetodoPago: 'met-efec',
  codigoMetodo: 'EFECTIVO',
  nombreMetodo: 'Efectivo',
  permiteRedondeo: true,
  estaActivo: true,
});

const metodoQr = new MetodoPago({
  idMetodoPago: 'met-qr',
  codigoMetodo: 'QR_TRANSFERENCIA',
  nombreMetodo: 'QR / Transferencia',
  permiteRedondeo: false,
  estaActivo: true,
});

const metodoTarjeta = new MetodoPago({
  idMetodoPago: 'met-tarj',
  codigoMetodo: 'TARJETA',
  nombreMetodo: 'Tarjeta',
  permiteRedondeo: false,
  estaActivo: true,
});

const encargado = new Usuario({
  idUsuario: 'user-enc',
  nombreCompleto: 'Martín Ruiz',
  rolUsuario: 'ENCARGADO',
  estaActivo: true,
  fechaAlta: new Date('2026-11-27T09:00:00.000Z'),
});

const cajero = new Usuario({
  idUsuario: 'user-caj',
  nombreCompleto: 'Lucas Gómez',
  rolUsuario: 'CAJERO',
  estaActivo: true,
  fechaAlta: new Date('2026-11-27T09:00:00.000Z'),
});

describe('Motor Determinístico de Redondeo/Tolerancia y Arqueo (Issue #5 · RN-03, RN-04, RN-07)', () => {
  it('canales digitales siempre seleccionan SinRedondeoStrategy con ajuste 0.00 aunque el margen sea $500 (RN-03)', () => {
    const margen500 = Dinero.desde('500.00');
    const estQr = metodoQr.obtenerEstrategiaRedondeo(margen500);
    const estTarj = metodoTarjeta.obtenerEstrategiaRedondeo(margen500);

    expect(estQr).toBeInstanceOf(SinRedondeoStrategy);
    expect(estTarj).toBeInstanceOf(SinRedondeoStrategy);

    const detalleQr = new DetalleArqueoMetodo({
      idDetalleArqueo: 'det-1',
      idArqueo: 'arq-1',
      metodoPago: metodoQr,
      montoEsperado: Dinero.desde('48200.00'),
      montoDeclarado: Dinero.desde('48000.00'),
    });
    detalleQr.calcularDiferencia(estQr);

    expect(detalleQr.ajusteRedondeo.aString()).toBe('0.00');
    expect(detalleQr.diferenciaReal.aString()).toBe('-200.00');
    expect(
      detalleQr.ajusteRedondeo.sumar(detalleQr.diferenciaReal).aString(),
    ).toBe(detalleQr.obtenerDiferenciaBruta().aString());
  });

  it('modo estricto ($0) no absorbe ningún faltante en efectivo (RN-04)', () => {
    const est = metodoEfectivo.obtenerEstrategiaRedondeo(Dinero.cero());
    expect(est).toBeInstanceOf(SinRedondeoStrategy);

    const detalle = new DetalleArqueoMetodo({
      idDetalleArqueo: 'det-efec',
      idArqueo: 'arq-1',
      metodoPago: metodoEfectivo,
      montoEsperado: Dinero.desde('62530.00'),
      montoDeclarado: Dinero.desde('62500.00'),
    });
    detalle.calcularDiferencia(est);

    expect(detalle.ajusteRedondeo.aString()).toBe('0.00');
    expect(detalle.diferenciaReal.aString()).toBe('-30.00');
  });

  it('margen configurable ($10, $100, $500) absorbe faltantes estrictamente menores y exige invariante bruta = ajuste + real', () => {
    // Caso 1: margen $100 con faltante -$30 -> absorbido
    const detalle100 = new DetalleArqueoMetodo({
      idDetalleArqueo: 'det-100',
      idArqueo: 'arq-100',
      metodoPago: metodoEfectivo,
      montoEsperado: Dinero.desde('62530.00'),
      montoDeclarado: Dinero.desde('62500.00'),
    });
    detalle100.calcularDiferencia(
      metodoEfectivo.obtenerEstrategiaRedondeo(Dinero.desde('100.00')),
    );
    expect(detalle100.ajusteRedondeo.aString()).toBe('-30.00');
    expect(detalle100.diferenciaReal.aString()).toBe('0.00');

    // Caso 2: margen $500 con faltante -$300 y límite -$499.99 -> absorbidos
    const est500 = metodoEfectivo.obtenerEstrategiaRedondeo(Dinero.desde('500.00'));
    expect(est500).toBeInstanceOf(RedondeoComercialStrategy);

    expect(est500.calcularAjuste(Dinero.desde('-300.00')).aString()).toBe('-300.00');
    expect(est500.calcularAjuste(Dinero.desde('-499.99')).aString()).toBe('-499.99');

    // Caso 3: margen $500 con faltante -$500.00 o -$1250.35 (>= margen) -> imputado como faltante real
    const detalleExactoLimite = new DetalleArqueoMetodo({
      idDetalleArqueo: 'det-lim',
      idArqueo: 'arq-500',
      metodoPago: metodoEfectivo,
      montoEsperado: Dinero.desde('10000.00'),
      montoDeclarado: Dinero.desde('9500.00'),
    });
    detalleExactoLimite.calcularDiferencia(est500);
    expect(detalleExactoLimite.ajusteRedondeo.aString()).toBe('0.00');
    expect(detalleExactoLimite.diferenciaReal.aString()).toBe('-500.00');

    const detalleMayor = new DetalleArqueoMetodo({
      idDetalleArqueo: 'det-may',
      idArqueo: 'arq-500',
      metodoPago: metodoEfectivo,
      montoEsperado: Dinero.desde('10000.00'),
      montoDeclarado: Dinero.desde('8749.65'),
    });
    detalleMayor.calcularDiferencia(est500);
    expect(detalleMayor.ajusteRedondeo.aString()).toBe('0.00');
    expect(detalleMayor.diferenciaReal.aString()).toBe('-1250.35');

    // Caso 4: margen $10 con centavos clásicos de punto flotante (0.10 + 0.20 vs 0.30)
    const esperadoDecimal = Dinero.desde('100.10').sumar(Dinero.desde('0.20'));
    expect(esperadoDecimal.aString()).toBe('100.30');

    const detalleCentavos = new DetalleArqueoMetodo({
      idDetalleArqueo: 'det-cent',
      idArqueo: 'arq-10',
      metodoPago: metodoEfectivo,
      montoEsperado: esperadoDecimal,
      montoDeclarado: Dinero.desde('100.29'),
    });
    detalleCentavos.calcularDiferencia(
      metodoEfectivo.obtenerEstrategiaRedondeo(Dinero.desde('10.00')),
    );
    expect(detalleCentavos.ajusteRedondeo.aString()).toBe('-0.01');
    expect(detalleCentavos.diferenciaReal.aString()).toBe('0.00');
    expect(
      detalleCentavos.ajusteRedondeo
        .sumar(detalleCentavos.diferenciaReal)
        .aString(),
    ).toBe('-0.01');
  });

  it('consolida ArqueoCierre con semáforos y política de sobrantes + alerta de posible reclamo (RN-07)', () => {
    // 1) Dentro de tolerancia
    const arqueoTolerancia = ArqueoCierre.calcular(
      {
        idArqueo: 'arq-tol',
        idTurno: 'tur-1',
        idUsuarioCierre: cajero.idUsuario,
        multiploRedondeoAplicado: Dinero.desde('100.00'),
        observacionesCierre: null,
        fechaHoraCierre: new Date('2026-11-27T21:00:00.000Z'),
      },
      [
        {
          idDetalleArqueo: 'd1',
          metodoPago: metodoEfectivo,
          montoEsperado: Dinero.desde('62530.00'),
          montoDeclarado: Dinero.desde('62500.00'),
        },
        {
          idDetalleArqueo: 'd2',
          metodoPago: metodoQr,
          montoEsperado: Dinero.desde('48200.00'),
          montoDeclarado: Dinero.desde('48200.00'),
        },
      ],
    );

    expect(arqueoTolerancia.totalEsperadoGeneral.aString()).toBe('110730.00');
    expect(arqueoTolerancia.totalDeclaradoGeneral.aString()).toBe('110700.00');
    expect(arqueoTolerancia.ajusteRedondeoTotal.aString()).toBe('-30.00');
    expect(arqueoTolerancia.diferenciaRealTotal.aString()).toBe('0.00');
    expect(arqueoTolerancia.obtenerEstadoResultado()).toBe('DENTRO_TOLERANCIA');
    expect(arqueoTolerancia.requiereAlertaPosibleReclamoCliente()).toBe(false);

    // 2) Sobrante <= margen: no dispara alerta de reclamo; sobrante > margen sí dispara
    const arqueoSobranteMenor = ArqueoCierre.calcular(
      {
        idArqueo: 'arq-sob-1',
        idTurno: 'tur-2',
        idUsuarioCierre: cajero.idUsuario,
        multiploRedondeoAplicado: Dinero.desde('500.00'),
        observacionesCierre: null,
        fechaHoraCierre: new Date(),
      },
      [
        {
          idDetalleArqueo: 'd1',
          metodoPago: metodoEfectivo,
          montoEsperado: Dinero.desde('10000.00'),
          montoDeclarado: Dinero.desde('10200.00'),
        },
      ],
    );
    expect(arqueoSobranteMenor.ajusteRedondeoTotal.aString()).toBe('0.00');
    expect(arqueoSobranteMenor.diferenciaRealTotal.aString()).toBe('200.00');
    expect(arqueoSobranteMenor.obtenerEstadoResultado()).toBe('SOBRANTE');
    expect(arqueoSobranteMenor.requiereAlertaPosibleReclamoCliente()).toBe(false);

    const arqueoSobranteAlto = ArqueoCierre.calcular(
      {
        idArqueo: 'arq-sob-2',
        idTurno: 'tur-3',
        idUsuarioCierre: cajero.idUsuario,
        multiploRedondeoAplicado: Dinero.desde('500.00'),
        observacionesCierre: null,
        fechaHoraCierre: new Date(),
      },
      [
        {
          idDetalleArqueo: 'd1',
          metodoPago: metodoEfectivo,
          montoEsperado: Dinero.desde('10000.00'),
          montoDeclarado: Dinero.desde('20000.00'),
        },
      ],
    );
    expect(arqueoSobranteAlto.diferenciaRealTotal.aString()).toBe('10000.00');
    expect(arqueoSobranteAlto.requiereAlertaPosibleReclamoCliente()).toBe(true);

    // 3) Modo estricto ($0): sobrante de +$1.00 supera margen $0 -> alerta true
    const arqueoEstrictoSobrante = ArqueoCierre.calcular(
      {
        idArqueo: 'arq-sob-est',
        idTurno: 'tur-4',
        idUsuarioCierre: cajero.idUsuario,
        multiploRedondeoAplicado: Dinero.cero(),
        observacionesCierre: null,
        fechaHoraCierre: new Date(),
      },
      [
        {
          idDetalleArqueo: 'd1',
          metodoPago: metodoEfectivo,
          montoEsperado: Dinero.desde('10000.00'),
          montoDeclarado: Dinero.desde('10001.00'),
        },
      ],
    );
    expect(arqueoEstrictoSobrante.requiereAlertaPosibleReclamoCliente()).toBe(true);
  });

  it('congela la foto histórica del múltiplo en ArqueoCierre aunque cambie ConfiguracionCaja (RN-04)', () => {
    const config = new ConfiguracionCaja({
      idConfiguracion: 'cfg-1',
      nombreComercio: 'FACOR',
      multiploRedondeoEfectivo: Dinero.desde('100.00'),
      idUsuarioActualizacion: encargado.idUsuario,
      fechaUltimaActualizacion: new Date('2026-11-27T10:00:00.000Z'),
    });

    const arqueoPrevio = ArqueoCierre.calcular(
      {
        idArqueo: 'arq-hist',
        idTurno: 'tur-hist',
        idUsuarioCierre: cajero.idUsuario,
        multiploRedondeoAplicado: config.getMultiploRedondeoEfectivo(),
        observacionesCierre: null,
        fechaHoraCierre: new Date('2026-11-27T14:00:00.000Z'),
      },
      [
        {
          idDetalleArqueo: 'd1',
          metodoPago: metodoEfectivo,
          montoEsperado: Dinero.desde('50050.00'),
          montoDeclarado: Dinero.desde('50000.00'),
        },
      ],
    );

    // El Encargado cambia luego la regla a $0 estricto (o $500)
    config.actualizarMultiplo(Dinero.desde('500.00'), encargado);
    expect(config.getMultiploRedondeoEfectivo().aString()).toBe('500.00');

    // El arqueo previo conserva su foto histórica inmutable de $100.00
    expect(arqueoPrevio.multiploRedondeoAplicado.aString()).toBe('100.00');
    expect(arqueoPrevio.ajusteRedondeoTotal.aString()).toBe('-50.00');
    expect(arqueoPrevio.diferenciaRealTotal.aString()).toBe('0.00');
  });

  it('valida invariantes negativas y permisos en ConfiguracionCaja y DetalleArqueoMetodo', () => {
    expect(() => new RedondeoComercialStrategy(Dinero.desde('-10.00'))).toThrow(
      MontoInvalidoError,
    );

    expect(() =>
      new DetalleArqueoMetodo({
        idDetalleArqueo: 'd-neg',
        idArqueo: 'a-neg',
        metodoPago: metodoEfectivo,
        montoEsperado: Dinero.desde('100.00'),
        montoDeclarado: Dinero.desde('-1.00'),
      }),
    ).toThrow(MontoInvalidoError);

    const arqueo = new ArqueoCierre({
      idArqueo: 'a-dup',
      idTurno: 't-dup',
      idUsuarioCierre: cajero.idUsuario,
      multiploRedondeoAplicado: Dinero.cero(),
      observacionesCierre: null,
      fechaHoraCierre: new Date(),
    });
    arqueo.agregarDetalle(
      new DetalleArqueoMetodo({
        idDetalleArqueo: 'd1',
        idArqueo: 'a-dup',
        metodoPago: metodoEfectivo,
        montoEsperado: Dinero.desde('100.00'),
        montoDeclarado: Dinero.desde('100.00'),
      }),
    );

    expect(() =>
      arqueo.agregarDetalle(
        new DetalleArqueoMetodo({
          idDetalleArqueo: 'd2',
          idArqueo: 'a-dup',
          metodoPago: metodoEfectivo,
          montoEsperado: Dinero.desde('200.00'),
          montoDeclarado: Dinero.desde('200.00'),
        }),
      ),
    ).toThrow(MetodoDuplicadoEnArqueoError);

    const config = new ConfiguracionCaja({
      idConfiguracion: 'cfg-2',
      nombreComercio: 'Comercio',
      multiploRedondeoEfectivo: Dinero.cero(),
      idUsuarioActualizacion: encargado.idUsuario,
      fechaUltimaActualizacion: new Date(),
    });

    expect(() =>
      config.actualizarMultiplo(Dinero.desde('100.00'), cajero),
    ).toThrow(RolNoAutorizadoError);

    expect(() =>
      config.actualizarMultiplo(Dinero.desde('-50.00'), encargado),
    ).toThrow(MontoInvalidoError);
  });
});
