import { CheckCircle2, Info, Loader2, Monitor, Play } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { ConflictBanner } from '../components/ConflictBanner';
import { useAuth } from '../context/AuthContext';
import { normalizarEntradaMonetaria } from '../lib/formatMoney';
import {
  abrirTurnoCaja,
  ApiError,
  obtenerCajasConEstado,
  obtenerCajasEnCache,
  type CajaConEstado,
} from '../services/api';

const ATAJOS_FONDO = [
  { label: '$0', valor: '0' },
  { label: '$10.000', valor: '10000' },
  { label: '$15.000', valor: '15000' },
  { label: '$20.000', valor: '20000' },
  { label: '$30.000', valor: '30000' },
];

export function AperturaPage() {
  const { setTurnoActivo, refrescarTurnoActivo } = useAuth();
  const navigate = useNavigate();

  const cajasCache = obtenerCajasEnCache()?.cajas;
  const [cajas, setCajas] = useState<CajaConEstado[]>(cajasCache ?? []);
  const [idCajaSeleccionada, setIdCajaSeleccionada] = useState<string>(
    cajasCache?.find((c) => c.estado_caja === 'LIBRE')?.id_caja ?? '',
  );
  const [cargandoCajas, setCargandoCajas] = useState(!cajasCache);
  const [montoTexto, setMontoTexto] = useState('15000');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictoTurno, setConflictoTurno] = useState<string | null>(null);

  const cargarCajas = useCallback(async (mostrarLoader = false) => {
    if (mostrarLoader) setCargandoCajas(true);
    try {
      const { cajas: lista } = await obtenerCajasConEstado();
      setCajas(lista);
      setIdCajaSeleccionada((prev) => {
        const sigueLibre = lista.some(
          (c) => c.id_caja === prev && c.estado_caja === 'LIBRE',
        );
        if (sigueLibre) return prev;
        const primeraLibre = lista.find((c) => c.estado_caja === 'LIBRE');
        return primeraLibre?.id_caja ?? '';
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el listado de cajas.',
      );
    } finally {
      setCargandoCajas(false);
    }
  }, []);

  useEffect(() => {
    void cargarCajas(!cajasCache);
  }, [cargarCajas]);

  const cajasLibres = cajas.filter((c) => c.estado_caja === 'LIBRE');

  async function manejarApertura(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setConflictoTurno(null);

    if (!idCajaSeleccionada) {
      setError('Seleccioná una caja física libre para iniciar tu turno.');
      return;
    }

    const decimalNormalizado = normalizarEntradaMonetaria(montoTexto);
    if (!decimalNormalizado) {
      setError('Ingresá un monto numérico válido con hasta 2 decimales (RN-06).');
      return;
    }

    if (decimalNormalizado.startsWith('-')) {
      setError(
        'El fondo inicial en efectivo debe ser mayor o igual a $0,00 (RN-06).',
      );
      return;
    }

    setEnviando(true);
    try {
      const { turno } = await abrirTurnoCaja(
        idCajaSeleccionada,
        decimalNormalizado,
      );
      setTurnoActivo(turno);
      navigate('/mostrador', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        if (err.codigo === 'CAJA_OCUPADA') {
          setConflictoTurno(
            'Esa caja acaba de ser abierta por otro operador. Actualizamos la disponibilidad para que elijas otra caja libre.',
          );
          await cargarCajas();
        } else {
          setConflictoTurno(
            'Ya tenés un turno de caja abierto. Sincronizamos tu sesión activa automáticamente.',
          );
          const activo = await refrescarTurnoActivo();
          if (activo) {
            navigate('/mostrador', { replace: true });
          }
        }
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('No se pudo abrir el turno de caja. Intentá nuevamente.');
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AppLayout>
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <form
          onSubmit={(e) => void manejarApertura(e)}
          className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              Validación RN-05: {cajasLibres.length} de {cajas.length} cajas
              disponibles
            </span>
          </div>

          <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Abrir Nuevo Turno de Caja
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Elegí la terminal física donde vas a operar y declará tu fondo
            inicial de cambio en efectivo.
          </p>

          {conflictoTurno && (
            <div className="mt-5">
              <ConflictBanner
                message={conflictoTurno}
                onRefresh={() => void cargarCajas()}
                onClose={() => setConflictoTurno(null)}
              />
            </div>
          )}

          {/* Selector Multi-Caja */}
          <div className="mt-6">
            <p className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2.5">
              1. SELECCIONÁ TU CAJA FÍSICA
            </p>

            {cargandoCajas ? (
              <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Consultando disponibilidad de cajas...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cajas.map((caja) => {
                  const ocupada = caja.estado_caja === 'OCUPADA';
                  const seleccionada = caja.id_caja === idCajaSeleccionada;

                  return (
                    <button
                      key={caja.id_caja}
                      type="button"
                      disabled={ocupada}
                      onClick={() => {
                        setIdCajaSeleccionada(caja.id_caja);
                        setError(null);
                      }}
                      className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                        ocupada
                          ? 'border-slate-200 bg-slate-50 opacity-65 cursor-not-allowed'
                          : seleccionada
                            ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20 cursor-pointer'
                            : 'border-slate-200 bg-white hover:border-slate-300 cursor-pointer'
                      }`}
                    >
                      <div
                        className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                          ocupada
                            ? 'bg-slate-200 text-slate-500'
                            : seleccionada
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        <Monitor className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            Caja #{caja.numero_caja}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              ocupada
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {ocupada ? 'Ocupada' : 'Libre'}
                          </span>
                        </div>
                        <p className="truncate text-xs text-slate-500 mt-0.5">
                          {ocupada && caja.turno_activo
                            ? `Operando: ${caja.turno_activo.usuario_apertura.nombre_completo}`
                            : caja.nombre_caja}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Fondo inicial */}
          <div className="mt-6">
            <label
              htmlFor="fondo-inicial"
              className="block text-xs font-bold tracking-wider uppercase text-slate-500 mb-2"
            >
              2. FONDO INICIAL EN EFECTIVO (DECIMAL &gt;= 0)
            </label>

            <div className="flex items-center rounded-xl border-2 border-slate-900 bg-white px-4 py-3 focus-within:ring-4 focus-within:ring-indigo-500/15">
              <span className="font-mono text-2xl font-bold text-slate-500 mr-2">
                $
              </span>
              <input
                id="fondo-inicial"
                type="text"
                inputMode="decimal"
                value={montoTexto}
                onChange={(e) => {
                  setMontoTexto(e.target.value);
                  setError(null);
                }}
                placeholder="15000,00"
                className="w-full font-mono text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums outline-none bg-transparent"
              />
              <span className="font-mono text-xs font-semibold text-slate-400 ml-2">
                ARS
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {ATAJOS_FONDO.map((atajo) => {
                const seleccionado =
                  normalizarEntradaMonetaria(montoTexto) ===
                  `${atajo.valor}.00`;
                return (
                  <button
                    key={atajo.valor}
                    type="button"
                    onClick={() => {
                      setMontoTexto(atajo.valor);
                      setError(null);
                    }}
                    className={`rounded-full px-3.5 py-1.5 font-mono text-xs font-semibold transition-colors cursor-pointer ${
                      seleccionado
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {atajo.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs sm:text-sm text-sky-900">
            <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <span>
              QR / Transferencia y Tarjeta inician automáticamente en $0,00 y no
              admiten redondeo comercial (RN-02, RN-03).
            </span>
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
            type="submit"
            disabled={enviando || cargandoCajas || cajasLibres.length === 0}
            className="mt-6 w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 transition-colors cursor-pointer"
          >
            {enviando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Abriendo turno...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Abrir Turno de Caja (Enter)</span>
              </>
            )}
          </button>
        </form>
      </div>
    </AppLayout>
  );
}
