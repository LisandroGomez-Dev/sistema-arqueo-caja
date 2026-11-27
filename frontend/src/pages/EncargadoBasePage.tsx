import {
  ArrowRight,
  Banknote,
  Clock,
  CreditCard,
  Loader2,
  Monitor,
  QrCode,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { formatearHoraArgentina, formatearPesos } from '../lib/formatMoney';
import {
  obtenerTurnosActivosEnCache,
  obtenerTurnosActivosEncargado,
  type CajaConEstado,
  type TurnoActivo,
} from '../services/api';

export function EncargadoBasePage() {
  const { usuario } = useAuth();
  const cacheInicial = obtenerTurnosActivosEnCache();
  const [turnos, setTurnos] = useState<TurnoActivo[]>(
    cacheInicial?.turnos ?? [],
  );
  const [cajas, setCajas] = useState<CajaConEstado[]>(
    cacheInicial?.cajas ?? [],
  );
  const [cargando, setCargando] = useState(!cacheInicial);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarTablero = useCallback(async (esManual = false) => {
    if (esManual) setActualizando(true);
    setError(null);
    try {
      const data = await obtenerTurnosActivosEncargado();
      setTurnos(data.turnos);
      setCajas(data.cajas);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el estado en vivo de las cajas.',
      );
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }, []);

  useEffect(() => {
    void cargarTablero(false);
  }, [cargarTablero]);

  const cantidadAbiertas = turnos.length;
  const cantidadLibres = cajas.length - cantidadAbiertas;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Cajas en Vivo — {usuario?.nombre_completo}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Supervisión multi-caja en tiempo real: {cantidadAbiertas} abiertas
              · {cantidadLibres} libres de {cajas.length} terminales habilitadas.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void cargarTablero(true)}
            disabled={actualizando}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${actualizando ? 'animate-spin' : ''}`} />
            <span>Actualizar cajas</span>
          </button>
        </header>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}

        {/* Grilla Multi-Caja en tiempo real */}
        {cargando && cajas.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 flex items-center justify-center gap-2.5 text-sm text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
            <span>Cargando terminales del local...</span>
          </div>
        ) : (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {cajas.map((caja) => {
              const turnoDetalle = turnos.find(
                (t) => t.caja.id_caja === caja.id_caja,
              );
              const abierta = Boolean(turnoDetalle);

              return (
                <div
                  key={caja.id_caja}
                  className={`rounded-2xl border p-5 shadow-sm transition-all ${
                    abierta
                      ? 'border-slate-200 bg-white'
                      : 'border-dashed border-slate-300 bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                          abierta
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-slate-200/80 text-slate-500'
                        }`}
                      >
                        <Monitor className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-extrabold text-slate-900">
                          Caja #{caja.numero_caja}
                        </h2>
                        <p className="text-xs text-slate-500">
                          {caja.nombre_caja}
                        </p>
                      </div>
                    </div>

                    {abierta && turnoDetalle ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span>
                          ABIERTA ·{' '}
                          {formatearHoraArgentina(
                            turnoDetalle.fecha_hora_apertura,
                          )}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200/80 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                        <Clock className="w-3 h-3" />
                        <span>CERRADA / LIBRE</span>
                      </span>
                    )}
                  </div>

                  {abierta && turnoDetalle ? (
                    <>
                      <div className="mt-4 flex items-center justify-between text-xs text-slate-600 border-t border-slate-100 pt-3">
                        <span>
                          Cajero:{' '}
                          <strong className="text-slate-900">
                            {turnoDetalle.usuario_apertura.nombre_completo}
                          </strong>
                        </span>
                        <span>
                          Fondo inicial:{' '}
                          <strong className="font-mono text-slate-900 tabular-nums">
                            {formatearPesos(turnoDetalle.fondo_inicial_efectivo)}
                          </strong>
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {turnoDetalle.subtotales_por_metodo.map((m) => (
                          <div
                            key={m.id_metodo_pago}
                            className="rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-2"
                          >
                            <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-500">
                              {m.codigo_metodo === 'EFECTIVO' ? (
                                <Banknote className="w-3 h-3 text-emerald-600" />
                              ) : m.codigo_metodo === 'QR_TRANSFERENCIA' ? (
                                <QrCode className="w-3 h-3 text-sky-600" />
                              ) : (
                                <CreditCard className="w-3 h-3 text-indigo-600" />
                              )}
                              <span className="truncate">
                                {m.codigo_metodo === 'EFECTIVO'
                                  ? 'Efectivo'
                                  : m.codigo_metodo === 'QR_TRANSFERENCIA'
                                    ? 'QR/Transf'
                                    : 'Tarjeta'}
                              </span>
                            </div>
                            <p className="mt-1 font-mono text-sm font-bold text-slate-900 tabular-nums">
                              {formatearPesos(m.monto_esperado)}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 flex justify-end">
                        <Link
                          to={`/mostrador/${turnoDetalle.id_turno}`}
                          state={{ turnoInicial: turnoDetalle }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white transition-colors"
                        >
                          <span>Supervisar Caja #{caja.numero_caja}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </>
                  ) : (
                    <p className="mt-4 text-xs text-slate-500 border-t border-slate-200/70 pt-3">
                      Disponible para que un cajero abra turno desde su pantalla
                      de Apertura.
                    </p>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* Módulos de gestión del roadmap */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  Auditoría, Anulaciones e Incidencias
                </h3>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                Issues #4 y #7
              </span>
            </div>
            <p className="mt-2.5 text-sm text-slate-500">
              Anulación lógica con motivo obligatorio por caja, historial de
              cierres, acumulado mensual de tolerancia por cajero y resolución de
              partes de incidencia 24/7.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  Configuración de Tolerancia / Redondeo
                </h3>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                Issue #5
              </span>
            </div>
            <p className="mt-2.5 text-sm text-slate-500">
              Definición del margen de tolerancia en efectivo ($0 estricto por
              defecto, $10, $100, $500 o valor personalizado) aplicable a cierres
              futuros sin alterar cierres históricos.
            </p>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
