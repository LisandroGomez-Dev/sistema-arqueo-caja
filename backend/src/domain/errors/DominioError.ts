/**
 * Error base del núcleo de dominio determinístico.
 */
export abstract class DominioError extends Error {
  abstract readonly codigo: string;
  abstract readonly statusHttp: number;

  constructor(mensaje: string) {
    super(mensaje);
    this.name = new.target.name;
  }
}

/** Se lanza cuando un operador intenta abrir otro turno teniendo ya uno ABIERTO (RN-05). */
export class TurnoYaAbiertoError extends DominioError {
  readonly codigo = 'TURNO_YA_ABIERTO';
  readonly statusHttp = 409;

  constructor(
    mensaje = 'Ya tenés un turno abierto en otra caja. Cerrá tu turno actual antes de abrir uno nuevo (RN-05).',
  ) {
    super(mensaje);
  }
}

/** Se lanza cuando se intenta abrir una caja física que ya tiene un turno ABIERTO (RN-05). */
export class CajaOcupadaError extends DominioError {
  readonly codigo = 'CAJA_OCUPADA';
  readonly statusHttp = 409;

  constructor(
    mensaje = 'La caja seleccionada ya se encuentra abierta por otro operador. Elegí una caja libre (RN-05).',
  ) {
    super(mensaje);
  }
}

/** Se lanza cuando la caja física indicada no existe o está inactiva. */
export class CajaNoEncontradaError extends DominioError {
  readonly codigo = 'CAJA_NO_ENCONTRADA';
  readonly statusHttp = 404;

  constructor(mensaje = 'La caja seleccionada no existe o no está habilitada.') {
    super(mensaje);
  }
}

/** Se lanza cuando el turno solicitado no existe. */
export class TurnoNoEncontradoError extends DominioError {
  readonly codigo = 'TURNO_NO_ENCONTRADO';
  readonly statusHttp = 404;

  constructor(mensaje = 'El turno de caja solicitado no existe.') {
    super(mensaje);
  }
}

/** Se lanza al operar sobre un turno cerrado (RN-05). */
export class TurnoCerradoError extends DominioError {
  readonly codigo = 'TURNO_CERRADO';
  readonly statusHttp = 409;

  constructor(
    mensaje = 'El turno de caja ya se encuentra cerrado y bloqueado para modificaciones.',
  ) {
    super(mensaje);
  }
}

/** Se lanza ante importes inválidos o negativos cuando se requiere >= 0 o > 0 (RN-06). */
export class MontoInvalidoError extends DominioError {
  readonly codigo = 'MONTO_INVALIDO';
  readonly statusHttp = 400;
}

/** Se lanza al registrar un EGRESO sin concepto/descripción (RN-06). */
export class ConceptoObligatorioError extends DominioError {
  readonly codigo = 'CONCEPTO_OBLIGATORIO';
  readonly statusHttp = 400;

  constructor(
    mensaje = 'Todo egreso requiere especificar un concepto o motivo obligatorio (RN-06).',
  ) {
    super(mensaje);
  }
}

/** Se lanza cuando el método de pago no existe o no está activo (RN-02). */
export class MetodoPagoInvalidoError extends DominioError {
  readonly codigo = 'METODO_PAGO_INVALIDO';
  readonly statusHttp = 400;

  constructor(
    mensaje = 'El método de pago seleccionado no existe o no está habilitado (RN-02).',
  ) {
    super(mensaje);
  }
}

/** Se lanza cuando el movimiento solicitado no existe. */
export class MovimientoNoEncontradoError extends DominioError {
  readonly codigo = 'MOVIMIENTO_NO_ENCONTRADO';
  readonly statusHttp = 404;

  constructor(mensaje = 'El movimiento de caja solicitado no existe.') {
    super(mensaje);
  }
}

/** Se lanza si se intenta anular un movimiento ya anulado previamente (RN-01). */
export class MovimientoYaAnuladoError extends DominioError {
  readonly codigo = 'MOVIMIENTO_YA_ANULADO';
  readonly statusHttp = 409;

  constructor(mensaje = 'Este movimiento ya fue anulado previamente (RN-01).') {
    super(mensaje);
  }
}

/** Se lanza al intentar anular sin ingresar un motivo válido (RN-01). */
export class MotivoAnulacionObligatorioError extends DominioError {
  readonly codigo = 'MOTIVO_ANULACION_OBLIGATORIO';
  readonly statusHttp = 400;

  constructor(
    mensaje = 'Debés ingresar un motivo obligatorio de al menos 3 caracteres para anular el movimiento (RN-01).',
  ) {
    super(mensaje);
  }
}

/** Se lanza ante acciones restringidas al rol ENCARGADO (RN-08). */
export class RolNoAutorizadoError extends DominioError {
  readonly codigo = 'ROL_NO_AUTORIZADO';
  readonly statusHttp = 403;

  constructor(
    mensaje = 'Tu rol no tiene permisos para ejecutar esta acción.',
  ) {
    super(mensaje);
  }
}

/** Se lanza cuando el operador o el PIN de mostrador son inválidos. */
export class CredencialesInvalidasError extends DominioError {
  readonly codigo = 'CREDENCIALES_INVALIDAS';
  readonly statusHttp = 401;

  constructor(mensaje = 'Operador o PIN incorrecto. Verificá los datos e intentá nuevamente.') {
    super(mensaje);
  }
}

/** Se lanza cuando el usuario solicitado no existe o está inactivo. */
export class UsuarioNoEncontradoError extends DominioError {
  readonly codigo = 'USUARIO_NO_ENCONTRADO';
  readonly statusHttp = 404;

  constructor(mensaje = 'El operador indicado no existe o no se encuentra activo.') {
    super(mensaje);
  }
}

/** Se lanza cuando no existe configuración de caja registrada. */
export class ConfiguracionNoEncontradaError extends DominioError {
  readonly codigo = 'CONFIGURACION_NO_ENCONTRADA';
  readonly statusHttp = 404;

  constructor(
    mensaje = 'No se encontró una configuración de caja activa para el comercio.',
  ) {
    super(mensaje);
  }
}

/** Se lanza si se intenta agregar más de una línea para el mismo método de pago en un arqueo. */
export class MetodoDuplicadoEnArqueoError extends DominioError {
  readonly codigo = 'METODO_DUPLICADO_EN_ARQUEO';
  readonly statusHttp = 409;

  constructor(
    mensaje = 'No puede repetirse el mismo método de pago dentro de un mismo arqueo de cierre.',
  ) {
    super(mensaje);
  }
}
