import { Check, Delete, Loader2, Shield, User } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ApiError,
  obtenerOperadores,
  obtenerOperadoresEnCache,
  type ConfiguracionPublica,
  type OperadorPublico,
} from '../services/api';

const DIGITOS_TECLADO = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function LoginPage() {
  const { iniciarSesion } = useAuth();
  const navigate = useNavigate();

  const cacheInicial = obtenerOperadoresEnCache();
  const [operadores, setOperadores] = useState<OperadorPublico[]>(
    cacheInicial?.operadores ?? [],
  );
  const [comercio, setComercio] = useState<ConfiguracionPublica | null>(
    cacheInicial?.comercio ?? null,
  );
  const [idSeleccionado, setIdSeleccionado] = useState<string>(
    cacheInicial?.operadores[0]?.id_usuario ?? '',
  );
  const [pin, setPin] = useState<string>('');
  const [cargandoLista, setCargandoLista] = useState(!cacheInicial);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function cargarOperadores() {
      try {
        const data = await obtenerOperadores();
        if (!cancelado) {
          setOperadores(data.operadores);
          setComercio(data.comercio);
          setIdSeleccionado((prev) =>
            prev && data.operadores.some((op) => op.id_usuario === prev)
              ? prev
              : (data.operadores[0]?.id_usuario ?? ''),
          );
        }
      } catch (err) {
        if (!cancelado && !cacheInicial) {
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudieron cargar los operadores habilitados.',
          );
        }
      } finally {
        if (!cancelado) {
          setCargandoLista(false);
        }
      }
    }

    void cargarOperadores();
    return () => {
      cancelado = true;
    };
  }, []);

  const agregarDigito = useCallback((digito: string) => {
    setError(null);
    setPin((prev) => (prev.length < 6 ? `${prev}${digito}` : prev));
  }, []);

  const borrarUltimo = useCallback(() => {
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  }, []);

  const enviarLogin = useCallback(async () => {
    if (!idSeleccionado) {
      setError('Seleccioná un operador para continuar.');
      return;
    }
    if (pin.length < 4) {
      setError('Ingresá al menos 4 dígitos de tu PIN.');
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      const turno = await iniciarSesion(idSeleccionado, pin);
      const operadorSeleccionado = operadores.find(
        (op) => op.id_usuario === idSeleccionado,
      );
      if (operadorSeleccionado?.rol_usuario === 'ENCARGADO') {
        navigate('/admin', { replace: true });
      } else {
        navigate(turno ? '/mostrador' : '/apertura', { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('No se pudo validar tu ingreso. Intentá nuevamente.');
      }
      setPin('');
    } finally {
      setEnviando(false);
    }
  }, [idSeleccionado, iniciarSesion, navigate, operadores, pin]);

  useEffect(() => {
    function manejarTeclado(e: KeyboardEvent) {
      if (enviando || cargandoLista) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        agregarDigito(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        borrarUltimo();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        void enviarLogin();
      }
    }

    window.addEventListener('keydown', manejarTeclado);
    return () => window.removeEventListener('keydown', manejarTeclado);
  }, [agregarDigito, borrarUltimo, cargandoLista, enviarLogin, enviando]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl grid grid-cols-1 lg:grid-cols-12">
        {/* Panel izquierdo identidad */}
        <div className="lg:col-span-5 bg-[#0F172A] text-white p-8 flex flex-col justify-between">
          <div>
            <span className="inline-block text-[11px] font-bold tracking-widest uppercase text-indigo-300">
              SISTEMA POS · ARQUEO INTELIGENTE
            </span>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
              ArqueoCaja
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Control exacto de efectivo, QR/transferencias y tarjetas con cierre
              de turno en 1 clic y Copiloto IA operativo 24/7.
            </p>
          </div>

          <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/90 p-4">
            <p className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
              COMERCIO CONFIGURADO
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {comercio?.nombre_comercio ?? 'Cargando comercio...'}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Regla efectivo vigente:{' '}
              {comercio?.multiplo_redondeo_efectivo === '0.00' || !comercio
                ? 'Modo estricto ($0)'
                : `Margen $${comercio.multiplo_redondeo_efectivo}`}
            </p>
          </div>
        </div>

        {/* Panel derecho login PIN */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto">
            <h2 className="text-2xl font-bold text-slate-900">
              Iniciar turno en mostrador
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Elegí tu operador e ingresá tu PIN con el teclado numérico.
            </p>

            {/* Selector de operador */}
            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                ¿Quién opera la caja?
              </p>

              {cargandoLista ? (
                <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cargando operadores...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {operadores.map((op) => {
                    const activo = op.id_usuario === idSeleccionado;
                    return (
                      <button
                        key={op.id_usuario}
                        type="button"
                        onClick={() => {
                          setIdSeleccionado(op.id_usuario);
                          setError(null);
                        }}
                        className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
                          activo
                            ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div
                          className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                            activo
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {op.rol_usuario === 'ENCARGADO' ? (
                            <Shield className="w-4 h-4" />
                          ) : (
                            <User className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {op.nombre_completo}
                          </p>
                          <p className="text-xs font-medium text-slate-500">
                            Rol: {op.rol_usuario}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Indicador visual del PIN */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  PIN de acceso (4–6 dígitos)
                </span>
                <span className="text-xs text-slate-400">
                  También podés tipear en teclado
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  {[0, 1, 2, 3, 4, 5].map((idx) => {
                    const lleno = idx < pin.length;
                    return (
                      <span
                        key={idx}
                        className={`h-3.5 w-3.5 rounded-full transition-colors ${
                          lleno
                            ? 'bg-slate-900'
                            : idx < 4
                              ? 'border-2 border-slate-300 bg-white'
                              : 'border border-dashed border-slate-300 bg-transparent'
                        }`}
                      />
                    );
                  })}
                </div>
                <span className="font-mono text-xs font-medium text-slate-400">
                  {pin.length}/6
                </span>
              </div>
            </div>

            {/* Teclado numérico táctil */}
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {DIGITOS_TECLADO.map((dig) => (
                <button
                  key={dig}
                  type="button"
                  onClick={() => agregarDigito(dig)}
                  disabled={enviando}
                  className="h-12 rounded-xl border border-slate-200 bg-white font-mono text-lg font-semibold text-slate-900 hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
                >
                  {dig}
                </button>
              ))}
              <button
                type="button"
                onClick={borrarUltimo}
                disabled={enviando}
                aria-label="Borrar último dígito"
                className="h-12 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <Delete className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => agregarDigito('0')}
                disabled={enviando}
                className="h-12 rounded-xl border border-slate-200 bg-white font-mono text-lg font-semibold text-slate-900 hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => void enviarLogin()}
                disabled={enviando}
                aria-label="Confirmar PIN"
                className="h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                <Check className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700"
              >
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={() => void enviarLogin()}
              disabled={enviando || cargandoLista}
              className="mt-5 w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 transition-colors cursor-pointer"
            >
              {enviando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validando operador...</span>
                </>
              ) : (
                <span>Ingresar al Mostrador (Enter)</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
