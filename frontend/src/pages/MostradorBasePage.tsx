import {
  ArrowLeft,
  Banknote,
  CreditCard,
  Loader2,
  Lock,
  QrCode,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { CargaRapidaCard } from '../components/CargaRapidaCard';
import { LibroDiarioTable } from '../components/LibroDiarioTable';
import { useAuth } from '../context/AuthContext';
import { formatearHoraArgentina, formatearPesos } from '../lib/formatMoney';
import {
  obtenerMovimientosEnCache,
  obtenerMovimientosTurno,
  obtenerTurnoEnCache,
  obtenerTurnoPorId,
  type MovimientoCaja,
  type TurnoActivo,
} from '../services/api';

function iconoMetodo(codigo: string) {
  if (codigo === 'EFECTIVO') {
    return (
      <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
        <Banknote className="w-5 h-5" />
      </div>
    );
  }
  if (codigo === 'QR_TRANSFERENCIA') {
    return (
      <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
        <QrCode className="w-5 h-5" />
      </div>
    );
  }
  return (
    <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
      <CreditCard className="w-5 h-5" />
    </div>
  );
}

export function MostradorBasePage() {
  const { idTurno } = useParams<{ idTurno: string }>();
  const location = useLocation();
  const { usuario, turnoActivo, setTurnoActivo } = useAuth();

  const estadoNav = location.state as { turnoInicial?: TurnoActivo } | null;
  const turnoInicial = idTurno
    ? (estadoNav?.turnoInicial ?? obtenerTurnoEnCache(idTurno))
    : null;

  const [turnoSupervisado, setTurnoSupervisado] = useState<TurnoActivo | null>(
    turnoInicial,
  );
  const [cargandoTurno, setCargandoTurno] = useState(
    Boolean(idTurno) && !turnoInicial,
  );
  const [errorTurno, setErrorTurno] = useState<string | null>(null);

  const esSupervision = Boolean(idTurno);
  const turnoMostrado = esSupervision ? turnoSupervisado : turnoActivo;
  const idTurnoActual = turnoMostrado?.id_turno ?? idTurno ?? null;

  const movsCache = idTurnoActual
    ? obtenerMovimientosEnCache(idTurnoActual)
    : null;
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>(
    movsCache ?? [],
  );
  const [cargandoMovs, setCargandoMovs] = useState(
    Boolean(idTurnoActual) && !movsCache,
  );

  useEffect(() => {
    if (!idTurno) {
      setTurnoSupervisado(null);
      setCargandoTurno(false);
      return;
    }

    const desdeCache = estadoNav?.turnoInicial ?? obtenerTurnoEnCache(idTurno);
    if (desdeCache) {
      setTurnoSupervisado(desdeCache);
      setCargandoTurno(false);
    } else {
      setCargandoTurno(true);
    }

    let cancelado = false;
    setErrorTurno(null);

    void obtenerTurnoPorId(idTurno)
      .then(({ turno }) => {
        if (!cancelado) setTurnoSupervisado(turno);
      })
      .catch((err) => {
        if (!cancelado && !desdeCache) {
          setErrorTurno(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar la caja seleccionada.',
          );
        }
      })
      .finally(() => {
        if (!cancelado) setCargandoTurno(false);
      });

    return () => {
      cancelado = true;
    };
  }, [estadoNav?.turnoInicial, idTurno]);

  useEffect(() => {
    if (!idTurnoActual) return;

    const desdeCache = obtenerMovimientosEnCache(idTurnoActual);
    if (desdeCache) {
      setMovimientos(desdeCache);
      setCargandoMovs(false);
    } else {
      setCargandoMovs(true);
    }

    let cancelado = false;
    void obtenerMovimientosTurno(idTurnoActual)
      .then(({ movimientos: lista }) => {
        if (!cancelado) setMovimientos(lista);
      })
      .catch(() => {
        // Mantiene caché si fallara la revalidación silenciosa
      })
      .finally(() => {
        if (!cancelado) setCargandoMovs(false);
      });

    return () => {
      cancelado = true;
    };
  }, [idTurnoActual]);

  function manejarNuevoMovimiento(
    movimiento: MovimientoCaja,
    turnoActualizado: TurnoActivo,
  ) {
    setMovimientos((prev) => [movimiento, ...prev]);
    if (esSupervision) {
      setTurnoSupervisado(turnoActualizado);
    }
    if (turnoActivo && turnoActivo.id_turno === turnoActualizado.id_turno) {
      setTurnoActivo(turnoActualizado);
    }
  }

  if (cargandoTurno) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
            <span>Cargando terminal de mostrador...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (errorTurno || !turnoMostrado) {
    return (
      <AppLayout>
        <div className="max-w-xl mx-auto mt-10 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
          <p className="font-semibold">
            {errorTurno ?? 'No se encontró un turno activo para mostrar.'}
          </p>
          {usuario?.rol_usuario === 'ENCARGADO' && (
            <Link
              to="/admin"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-rose-900 underline"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a Cajas en Vivo</span>
            </Link>
          )}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {esSupervision && usuario?.rol_usuario === 'ENCARGADO' && (
          <div>
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a Cajas en Vivo</span>
            </Link>
          </div>
        )}

        {/* Cabecera superior fiel a P3 Figma */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Terminal de Mostrador — Caja #{turnoMostrado.caja.numero_caja}
              </h1>
              <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                {turnoMostrado.caja.nombre_caja}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Abierta {formatearHoraArgentina(turnoMostrado.fecha_hora_apertura)}{' '}
              hs · Fondo inicial:{' '}
              <span className="font-mono font-semibold text-slate-700 tabular-nums">
                {formatearPesos(turnoMostrado.fondo_inicial_efectivo)}
              </span>{' '}
              · Atajos: F1 Ingreso · F2 Egreso · Operador:{' '}
              {turnoMostrado.usuario_apertura.nombre_completo}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled
              title="Disponible en Milestone v0.4 (Issues #8-#10)"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600/50 px-4 py-2.5 text-sm font-semibold text-white cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4" />
              <span>Abrir Copiloto IA ←</span>
              <span className="rounded bg-indigo-900/40 px-1.5 py-0.5 text-[10px]">
                v0.4
              </span>
            </button>

            <button
              type="button"
              disabled
              title="Disponible en Milestone v0.3 (Issue #6)"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600/50 px-4 py-2.5 text-sm font-semibold text-white cursor-not-allowed"
            >
              <Lock className="w-4 h-4" />
              <span>Cerrar Caja en 1 Clic</span>
              <span className="rounded bg-emerald-950/30 px-1.5 py-0.5 text-[10px]">
                v0.3
              </span>
            </button>
          </div>
        </header>

        {/* Tarjetas KPI en vivo por canal (RN-02) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {turnoMostrado.subtotales_por_metodo.map((metodo) => (
            <div
              key={metodo.id_metodo_pago}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-4"
            >
              {iconoMetodo(metodo.codigo_metodo)}
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-wider uppercase text-slate-500">
                  {metodo.codigo_metodo === 'EFECTIVO'
                    ? 'EFECTIVO EN CAJÓN'
                    : metodo.nombre_metodo.toUpperCase()}
                </p>
                <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                  {formatearPesos(metodo.monto_esperado)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {metodo.codigo_metodo === 'EFECTIVO'
                    ? `Inc. ${formatearPesos(turnoMostrado.fondo_inicial_efectivo)} fondo · ${
                        turnoMostrado.configuracion.multiplo_redondeo_efectivo ===
                        '0.00'
                          ? 'Estricto $0'
                          : `Margen $${turnoMostrado.configuracion.multiplo_redondeo_efectivo}`
                      }`
                    : 'Conciliación exacta (RN-03)'}
                </p>
              </div>
            </div>
          ))}
        </section>

        {/* Layout 2 columnas fiel a P3 Figma: Carga Rápida (izq) + Libro Diario en vivo (der) */}
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <div className="xl:col-span-5">
            <CargaRapidaCard
              idTurno={turnoMostrado.id_turno}
              onMovimientoRegistrado={manejarNuevoMovimiento}
            />
          </div>

          <div className="xl:col-span-7">
            <LibroDiarioTable
              movimientos={movimientos}
              cargando={cargandoMovs}
            />
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
