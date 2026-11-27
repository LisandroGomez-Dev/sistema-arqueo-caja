const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'
).replace(/\/$/, '');

export type RolUsuario = 'CAJERO' | 'ENCARGADO';
export type TipoMovimiento = 'INGRESO' | 'EGRESO';
export type CodigoMetodoPago = 'EFECTIVO' | 'QR_TRANSFERENCIA' | 'TARJETA';
export type OrigenCarga = 'MANUAL' | 'IA_VOZ_TEXTO' | 'IA_COMPROBANTE';
export type EstadoMovimiento = 'ACTIVO' | 'ANULADO';

export interface MovimientoCaja {
  id_movimiento: string;
  id_turno: string;
  tipo_movimiento: TipoMovimiento;
  monto_operacion: string;
  concepto_descripcion: string | null;
  origen_carga: OrigenCarga;
  url_comprobante: string | null;
  estado_movimiento: EstadoMovimiento;
  motivo_anulacion: string | null;
  fecha_hora_anulacion: string | null;
  fecha_hora_registro: string;
  metodo_pago: {
    id_metodo_pago: string;
    codigo_metodo: string;
    nombre_metodo: string;
  };
  usuario_registro: OperadorPublico;
  usuario_anulacion: OperadorPublico | null;
}

export interface OperadorPublico {
  id_usuario: string;
  nombre_completo: string;
  rol_usuario: RolUsuario;
}

export interface CajaResumen {
  id_caja: string;
  numero_caja: number;
  nombre_caja: string;
}

export interface CajaConEstado extends CajaResumen {
  estado_caja: 'LIBRE' | 'OCUPADA';
  turno_activo: {
    id_turno: string;
    fecha_hora_apertura: string;
    fondo_inicial_efectivo: string;
    usuario_apertura: OperadorPublico;
  } | null;
}

export interface ConfiguracionPublica {
  nombre_comercio: string;
  multiplo_redondeo_efectivo: string;
}

export interface ConfiguracionCajaDetalle {
  id_configuracion: string;
  nombre_comercio: string;
  multiplo_redondeo_efectivo: string;
  fecha_ultima_actualizacion: string;
  usuario_actualizacion: OperadorPublico | null;
}

export interface SubtotalMetodo {
  id_metodo_pago: string;
  codigo_metodo: string;
  nombre_metodo: string;
  permite_redondeo: boolean;
  monto_esperado: string;
}

export interface TurnoActivo {
  id_turno: string;
  estado_turno: 'ABIERTO' | 'CERRADO';
  fondo_inicial_efectivo: string;
  fecha_hora_apertura: string;
  fecha_hora_cierre: string | null;
  caja: CajaResumen;
  usuario_apertura: OperadorPublico;
  subtotales_por_metodo: SubtotalMetodo[];
  configuracion: ConfiguracionPublica;
}

export class ApiError extends Error {
  readonly status: number;
  readonly codigo: string;
  readonly data: unknown;

  constructor(status: number, message: string, codigo = 'ERROR_API', data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.codigo = codigo;
    this.data = data;
  }
}

const TOKEN_STORAGE_KEY = 'arqueo_caja_jwt';

export function obtenerTokenGuardado(): string | null {
  return sessionStorage.getItem(TOKEN_STORAGE_KEY);
}

export function guardarToken(token: string): void {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function limpiarToken(): void {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

// Caché SWR en memoria + deduplicación de peticiones GET en vuelo
const cacheDatos = new Map<string, { valor: unknown; guardadoEn: number }>();
const peticionesEnVuelo = new Map<string, Promise<unknown>>();

export function invalidarCacheOperativa(): void {
  for (const key of Array.from(cacheDatos.keys())) {
    if (key !== 'GET:/auth/operadores') {
      cacheDatos.delete(key);
    }
  }
}

function leerCache<T>(key: string, maxEdadMs = 60_000): T | null {
  const entry = cacheDatos.get(key);
  if (!entry) return null;
  if (Date.now() - entry.guardadoEn > maxEdadMs) {
    return null;
  }
  return entry.valor as T;
}

function escribirCache<T>(key: string, valor: T): void {
  cacheDatos.set(key, { valor, guardadoEn: Date.now() });
}

async function request<T>(
  endpoint: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string | null;
    cacheKey?: string;
  } = {},
): Promise<T> {
  const method = options.method ?? 'GET';
  const cacheKey = options.cacheKey ?? (method === 'GET' ? `GET:${endpoint}` : undefined);

  if (method === 'GET' && cacheKey && peticionesEnVuelo.has(cacheKey)) {
    return peticionesEnVuelo.get(cacheKey) as Promise<T>;
  }

  const ejecutar = async (): Promise<T> => {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {};

    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const authToken = options.token ?? obtenerTokenGuardado();
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } catch {
      throw new ApiError(
        0,
        'No se pudo conectar con el servidor de caja. Verificá que el backend esté encendido.',
        'SIN_CONEXION',
      );
    }

    if (!response.ok) {
      let errorBody: { message?: string; codigo?: string } = {};
      try {
        errorBody = (await response.json()) as { message?: string; codigo?: string };
      } catch {
        errorBody = { message: response.statusText };
      }

      throw new ApiError(
        response.status,
        errorBody.message || 'Ocurrió un error al comunicarse con el servidor.',
        errorBody.codigo || 'ERROR_HTTP',
        errorBody,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const data = (await response.json()) as T;
    if (method === 'GET' && cacheKey) {
      escribirCache(cacheKey, data);
    }
    return data;
  };

  if (method === 'GET' && cacheKey) {
    const promesa = ejecutar().finally(() => {
      peticionesEnVuelo.delete(cacheKey);
    });
    peticionesEnVuelo.set(cacheKey, promesa);
    return promesa;
  }

  return ejecutar();
}

export function obtenerOperadoresEnCache(): {
  operadores: OperadorPublico[];
  comercio: ConfiguracionPublica;
} | null {
  return leerCache('GET:/auth/operadores', 300_000);
}

export function obtenerOperadores(): Promise<{
  operadores: OperadorPublico[];
  comercio: ConfiguracionPublica;
}> {
  return request('/auth/operadores');
}

export function iniciarSesionPin(
  idUsuario: string,
  pin: string,
): Promise<{
  token: string;
  usuario: OperadorPublico;
  turno: TurnoActivo | null;
}> {
  return request('/auth/login', {
    method: 'POST',
    body: { id_usuario: idUsuario, pin },
  });
}

export function obtenerUsuarioActual(
  token?: string,
): Promise<{ usuario: OperadorPublico }> {
  return request('/auth/me', { token });
}

export function obtenerCajasEnCache(): { cajas: CajaConEstado[] } | null {
  return leerCache('GET:/cajas', 30_000);
}

export function obtenerCajasConEstado(): Promise<{ cajas: CajaConEstado[] }> {
  return request('/cajas');
}

export function obtenerTurnoActivo(
  token?: string,
): Promise<{ turno: TurnoActivo | null }> {
  return request('/turnos/activo', { token });
}

export function obtenerTurnosActivosEnCache(): {
  turnos: TurnoActivo[];
  cajas: CajaConEstado[];
} | null {
  return leerCache('GET:/turnos/activos', 30_000);
}

export async function obtenerTurnosActivosEncargado(): Promise<{
  turnos: TurnoActivo[];
  cajas: CajaConEstado[];
}> {
  const data = await request<{
    turnos: TurnoActivo[];
    cajas: CajaConEstado[];
  }>('/turnos/activos');

  // Hidratar cachés derivadas para navegación instantánea a /apertura y /mostrador/:id
  escribirCache('GET:/cajas', { cajas: data.cajas });
  for (const turno of data.turnos) {
    escribirCache(`GET:/turnos/${turno.id_turno}`, { turno });
  }
  return data;
}

export function obtenerTurnoEnCache(idTurno: string): TurnoActivo | null {
  return leerCache<{ turno: TurnoActivo }>(`GET:/turnos/${idTurno}`, 30_000)?.turno ?? null;
}

export function obtenerTurnoPorId(
  idTurno: string,
): Promise<{ turno: TurnoActivo }> {
  return request(`/turnos/${idTurno}`);
}

export async function abrirTurnoCaja(
  idCaja: string,
  fondoInicialEfectivo: string,
): Promise<{ turno: TurnoActivo }> {
  const data = await request<{ turno: TurnoActivo }>('/turnos/abrir', {
    method: 'POST',
    body: {
      id_caja: idCaja,
      fondo_inicial_efectivo: fondoInicialEfectivo,
    },
  });
  invalidarCacheOperativa();
  escribirCache(`GET:/turnos/${data.turno.id_turno}`, data);
  return data;
}

export function obtenerMovimientosEnCache(
  idTurno: string,
): MovimientoCaja[] | null {
  return (
    leerCache<{ movimientos: MovimientoCaja[] }>(
      `GET:/turnos/${idTurno}/movimientos`,
      30_000,
    )?.movimientos ?? null
  );
}

export function obtenerMovimientosTurno(
  idTurno: string,
): Promise<{ movimientos: MovimientoCaja[] }> {
  return request(`/turnos/${idTurno}/movimientos`);
}

export async function registrarMovimientoTurno(
  idTurno: string,
  payload: {
    tipo_movimiento: TipoMovimiento;
    codigo_metodo_pago: CodigoMetodoPago;
    monto_operacion: string;
    concepto_descripcion?: string | null;
    origen_carga?: OrigenCarga;
  },
): Promise<{ movimiento: MovimientoCaja; turno: TurnoActivo }> {
  const data = await request<{ movimiento: MovimientoCaja; turno: TurnoActivo }>(
    `/turnos/${idTurno}/movimientos`,
    {
      method: 'POST',
      body: {
        ...payload,
        origen_carga: payload.origen_carga ?? 'MANUAL',
      },
    },
  );

  // Actualizar cachés locales inmediatamente para respuesta 0ms en navegación
  escribirCache(`GET:/turnos/${idTurno}`, { turno: data.turno });
  const prevMovs = obtenerMovimientosEnCache(idTurno) ?? [];
  escribirCache(`GET:/turnos/${idTurno}/movimientos`, {
    movimientos: [data.movimiento, ...prevMovs],
  });
  cacheDatos.delete('GET:/turnos/activos');

  return data;
}

export interface ReemplazoMovimientoPayload {
  tipo_movimiento?: TipoMovimiento;
  codigo_metodo_pago?: CodigoMetodoPago;
  monto_operacion: string;
  concepto_descripcion?: string | null;
}

export async function anularMovimientoTurno(
  idMovimiento: string,
  motivoAnulacion: string,
  reemplazo?: ReemplazoMovimientoPayload | null,
): Promise<{
  movimiento: MovimientoCaja;
  movimiento_reemplazo: MovimientoCaja | null;
  turno: TurnoActivo;
}> {
  const data = await request<{
    movimiento: MovimientoCaja;
    movimiento_reemplazo: MovimientoCaja | null;
    turno: TurnoActivo;
  }>(`/movimientos/${idMovimiento}/anular`, {
    method: 'PATCH',
    body: {
      motivo_anulacion: motivoAnulacion,
      ...(reemplazo ? { reemplazo } : {}),
    },
  });

  const idTurno = data.turno.id_turno;
  escribirCache(`GET:/turnos/${idTurno}`, { turno: data.turno });
  const prevMovs = obtenerMovimientosEnCache(idTurno);
  if (prevMovs) {
    const actualizados = prevMovs.map((m) =>
      m.id_movimiento === data.movimiento.id_movimiento ? data.movimiento : m,
    );
    escribirCache(`GET:/turnos/${idTurno}/movimientos`, {
      movimientos: data.movimiento_reemplazo
        ? [data.movimiento_reemplazo, ...actualizados]
        : actualizados,
    });
  }
  cacheDatos.delete('GET:/turnos/activos');

  return data;
}

export function obtenerConfiguracionCajaEnCache(): ConfiguracionCajaDetalle | null {
  return (
    leerCache<{ configuracion: ConfiguracionCajaDetalle }>(
      'GET:/configuracion/caja',
      60_000,
    )?.configuracion ?? null
  );
}

export function obtenerConfiguracionCaja(): Promise<{
  configuracion: ConfiguracionCajaDetalle;
}> {
  return request('/configuracion/caja');
}

export async function actualizarConfiguracionRedondeo(
  multiploRedondeoEfectivo: string,
): Promise<{ configuracion: ConfiguracionCajaDetalle }> {
  const data = await request<{ configuracion: ConfiguracionCajaDetalle }>(
    '/configuracion/caja',
    {
      method: 'PATCH',
      body: { multiplo_redondeo_efectivo: multiploRedondeoEfectivo },
    },
  );

  invalidarCacheOperativa();
  cacheDatos.delete('GET:/auth/operadores');
  escribirCache('GET:/configuracion/caja', data);

  return data;
}
