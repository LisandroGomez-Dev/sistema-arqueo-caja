import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CreditCard,
  Info,
  Loader2,
  Lock,
  QrCode,
  ShieldAlert,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import {
  formatearHoraArgentina,
  formatearPesos,
  normalizarEntradaMonetaria,
} from '../lib/formatMoney';
import {
  simularArqueoEnVivo,
  type SimulacionArqueoEnVivo,
} from '../lib/motorArqueo';
import {
  ApiError,
  cerrarTurnoCaja,
  obtenerTurnoEnCache,
  obtenerTurnoPorId,
  type TurnoActivo,
} from '../services/api';

function formatearInputDesdeDecimal(montoDecimal: string): string {
  const [entero = '0', dec = '00'] = montoDecimal.trim().split('.');
  if (dec === '00') return entero;
  return `${entero},${dec}`;
}

function tarjetaSemaforo(sim: SimulacionArqueoEnVivo) {
  switch (sim.estadoResultado) {
    case 'CUADRE_PERFECTO':
      return {
        clase: 'border-emerald-200 bg-emerald-50 text-emerald-900',
        icono: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
        titulo: 'CUADRE PERFECTO',
        detalle:
          'Caja cuadrada exacta ($ 0,00). Lista para confirmar el cierre en 1 clic.',
      };
    case 'DENTRO_TOLERANCIA':
      return {
        clase: 'border-sky-200 bg-sky-50 text-sky-900',
        icono: <Info className="w-5 h-5 text-sky-600 shrink-0" />,
        titulo: 'DENTRO DE TOLERANCIA / REDONDEO',
        detalle: `Redondeo absorbido: ${formatearPesos(sim.ajusteRedondeoTotal)} (margen ${formatearPesos(sim.multiploAplicado)}). Diferencia real: $ 0,00.`,
      };
    case 'SOBRANTE':
      return {
        clase: 'border-amber-200 bg-amber-50 text-amber-900',
        icono: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
        titulo: `SOBRANTE DE +${formatearPesos(sim.diferenciaRealTotal)}`,
        detalle: sim.alertaPosibleReclamoCliente
          ? 'Queda a favor de la empresa. Supera el margen: alerta de posible reclamo de cliente (RN-07).'
          : 'Queda registrado a favor de la empresa (RN-07).',
      };
    case 'FALTANTE':
      return {
        clase: 'border-rose-200 bg-rose-50 text-rose-900',
        icono: <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />,
        titulo: `FALTANTE REAL DE ${formatearPesos(sim.diferenciaRealTotal)}`,
        detalle:
          'Faltante imputable al cierre. Revisá egresos sin cargar o movimientos anulados antes de confirmar.',
      };
  }
}

export function CierreCajaPage() {
  const { idTurno } = useParams<{ idTurno: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { usuario, turnoActivo } = useAuth();

  const estadoNav = location.state as { turnoInicial?: TurnoActivo } | null;
  const turnoInicial = idTurno
    ? (estadoNav?.turnoInicial ?? obtenerTurnoEnCache(idTurno))
    : turnoActivo;

  const [turnoSupervisado, setTurnoSupervisado] = useState<TurnoActivo | null>(
    idTurno ? turnoInicial : null,
  );
  const [cargando, setCargando] = useState(Boolean(idTurno) && !turnoInicial);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const esSupervision = Boolean(idTurno);
  const turnoObjetivo = esSupervision ? turnoSupervisado : turnoActivo;

  const efectivoInicial =
    turnoObjetivo?.subtotales_por_metodo.find(
      (m) => m.codigo_metodo === 'EFECTIVO',
    )?.monto_esperado ?? '0.00';

  const [efectivoTexto, setEfectivoTexto] = useState<string>(() =>
    formatearInputDesdeDecimal(efectivoInicial),
  );
  const [inicializadoDesdeTurno, setInicializadoDesdeTurno] = useState<
    string | null
  >(turnoObjetivo?.id_turno ?? null);
  const [observaciones, setObservaciones] = useState('');
  const [cerrando, setCerrando] = useState(false);
  const [errorSubmit, setErrorSubmit] = useState<string | null>(null);

  useEffect(() => {
    if (!idTurno) {
      setTurnoSupervisado(null);
      setCargando(false);
      return;
    }

    let cancelado = false;
    setErrorCarga(null);

    void obtenerTurnoPorId(idTurno)
      .then(({ turno }) => {
        if (!cancelado) setTurnoSupervisado(turno);
      })
      .catch((err) => {
        if (!cancelado && !turnoInicial) {
          setErrorCarga(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar el turno a cerrar.',
          );
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [idTurno, turnoInicial]);

  useEffect(() => {
    if (!turnoObjetivo) return;
    if (inicializadoDesdeTurno === turnoObjetivo.id_turno) return;

    const esperadoEfec =
      turnoObjetivo.subtotales_por_metodo.find(
        (m) => m.codigo_metodo === 'EFECTIVO',
      )?.monto_esperado ?? '0.00';
    setEfectivoTexto(formatearInputDesdeDecimal(esperadoEfec));
    setInicializadoDesdeTurno(turnoObjetivo.id_turno);
  }, [turnoObjetivo, inicializadoDesdeTurno]);

  if (cargando) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
            <span>Preparando arqueo y cierre de turno...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (errorCarga || !turnoObjetivo) {
    return (
      <AppLayout>
        <div className="max-w-xl mx-auto mt-10 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800 space-y-3">
          <p className="font-semibold">
            {errorCarga ?? 'No hay un turno abierto disponible para cerrar.'}
          </p>
          <Link
            to={usuario?.rol_usuario === 'ENCARGADO' ? '/admin' : '/apertura'}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-900 underline"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver</span>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const rutaVolver = esSupervision
    ? `/mostrador/${turnoObjetivo.id_turno}`
    : '/mostrador';

  const digitales = turnoObjetivo.subtotales_por_metodo.filter(
    (m) => m.codigo_metodo !== 'EFECTIVO',
  );
  const metodoEfectivo = turnoObjetivo.subtotales_por_metodo.find(
    (m) => m.codigo_metodo === 'EFECTIVO',
  );
  const efectivoEsperado = metodoEfectivo?.monto_esperado ?? '0.00';

  const efectivoNormalizado = normalizarEntradaMonetaria(efectivoTexto);
  const efectivoValido =
    efectivoNormalizado !== null && !efectivoNormalizado.startsWith('-');

  const simulacion = simularArqueoEnVivo(
    turnoObjetivo,
    efectivoValido ? efectivoNormalizado : efectivoEsperado,
  );
  const semaforo = tarjetaSemaforo(simulacion);

  async function manejarConfirmarCierre(e: FormEvent) {
    e.preventDefault();
    setErrorSubmit(null);

    if (!turnoObjetivo) return;

    if (!efectivoNormalizado || efectivoNormalizado.startsWith('-')) {
      setErrorSubmit(
        'Ingresá el efectivo físico contado mayor o igual a $ 0,00 (RN-06).',
      );
      return;
    }

    setCerrando(true);
    try {
      const { arqueo } = await cerrarTurnoCaja(turnoObjetivo.id_turno, {
        efectivo_declarado: efectivoNormalizado,
        observaciones_cierre: observaciones.trim() || null,
      });

      navigate(`/cierre/comprobante/${arqueo.id_arqueo}`, {
        replace: true,
        state: { arqueoInicial: arqueo },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorSubmit(err.message);
      } else {
        setErrorSubmit('No se pudo cerrar la caja. Intentá nuevamente.');
      }
    } finally {
      setCerrando(false);
    }
  }

  const reglaTexto =
    turnoObjetivo.configuracion.multiplo_redondeo_efectivo === '0.00'
      ? 'Estricto $ 0,00 (tolerancia cero)'
      : `Margen de tolerancia ${formatearPesos(
          turnoObjetivo.configuracion.multiplo_redondeo_efectivo,
        )}`;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Cabecera */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Link
              to={rutaVolver}
              state={{ turnoInicial: turnoObjetivo }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver al Mostrador (Caja #{turnoObjetivo.caja.numero_caja})</span>
            </Link>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Arqueo y Cierre en 1 Clic — Caja #{turnoObjetivo.caja.numero_caja}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Motor 100% determinístico · Apertura{' '}
              {formatearHoraArgentina(turnoObjetivo.fecha_hora_apertura)} hs ·
              Operador: {turnoObjetivo.usuario_apertura.nombre_completo}
            </p>
          </div>

          <span className="self-start md:self-center rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-xs font-bold text-indigo-700">
            Regla vigente: {reglaTexto} · RN-04
          </span>
        </div>

        <form
          onSubmit={(e) => void manejarConfirmarCierre(e)}
          className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start"
        >
          {/* Columna izquierda: Canales digitales + Conteo físico */}
          <div className="xl:col-span-7 space-y-5">
            {/* 1. Canales digitales */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-3.5">
              <p className="text-[11px] font-bold tracking-wider uppercase text-slate-500">
                1. CANALES DIGITALES — CONCILIACIÓN CERO-DESCUADRE (RN-03)
              </p>

              <div className="space-y-2.5">
                {digitales.map((canal) => (
                  <div
                    key={canal.id_metodo_pago}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                          canal.codigo_metodo === 'QR_TRANSFERENCIA'
                            ? 'bg-sky-100 text-sky-600'
                            : 'bg-indigo-100 text-indigo-600'
                        }`}
                      >
                        {canal.codigo_metodo === 'QR_TRANSFERENCIA' ? (
                          <QrCode className="w-4 h-4" />
                        ) : (
                          <CreditCard className="w-4 h-4" />
                        )}
                      </div>
                      <span className="text-sm font-semibold text-slate-800 truncate">
                        {canal.nombre_metodo}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
                        {formatearPesos(canal.monto_esperado)}
                      </span>
                      <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                        ✓ Exacto ($0 dif.)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 2. Conteo físico efectivo */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[11px] font-bold tracking-wider uppercase text-slate-500">
                  2. CONTEO DE EFECTIVO EN CAJÓN (RN-02, RN-07)
                </p>
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <span>
                    Esperado (inc. {formatearPesos(turnoObjetivo.fondo_inicial_efectivo)} fondo):
                  </span>
                  <strong className="font-mono text-sm text-slate-900 tabular-nums">
                    {formatearPesos(efectivoEsperado)}
                  </strong>
                </div>
              </div>

              <div>
                <label
                  htmlFor="efectivo-declarado"
                  className="block text-xs font-semibold text-slate-700 mb-2"
                >
                  Efectivo físico contado
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="flex-1 flex items-center rounded-xl border-2 border-slate-900 bg-white px-4 py-3 focus-within:ring-4 focus-within:ring-indigo-500/15">
                    <span className="font-mono text-xl font-bold text-slate-500 mr-2">
                      $
                    </span>
                    <input
                      id="efectivo-declarado"
                      type="text"
                      inputMode="decimal"
                      autoFocus
                      value={efectivoTexto}
                      onChange={(e) => {
                        setEfectivoTexto(e.target.value);
                        setErrorSubmit(null);
                      }}
                      placeholder="0,00"
                      className="w-full font-mono text-2xl font-bold text-slate-900 tabular-nums outline-none bg-transparent"
                    />
                    <span className="font-mono text-xs font-semibold text-slate-400 ml-2">
                      ARS
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEfectivoTexto(
                        formatearInputDesdeDecimal(efectivoEsperado),
                      );
                      setErrorSubmit(null);
                    }}
                    className="h-12 sm:h-auto rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-4 text-xs sm:text-sm font-bold text-emerald-800 transition-colors cursor-pointer shrink-0"
                  >
                    ✓ Coincide exacto
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="observaciones-cierre"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Observaciones de cierre (opcional)
                </label>
                <textarea
                  id="observaciones-cierre"
                  rows={2}
                  maxLength={500}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Ej.: Cambio en monedas dejado en cajón para turno siguiente"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none"
                />
              </div>
            </section>
          </div>

          {/* Columna derecha: Resultado en vivo + Cierre definitivo */}
          <aside className="xl:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <p className="text-[11px] font-bold tracking-wider uppercase text-slate-500">
              RESULTADO DEL ARQUEO EN VIVO
            </p>

            {/* Semáforo */}
            {!efectivoValido ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs sm:text-sm font-medium text-rose-700">
                Ingresá un monto de efectivo válido mayor o igual a $ 0,00.
              </div>
            ) : (
              <div
                className={`rounded-xl border p-4 flex items-start gap-3 ${semaforo.clase}`}
              >
                {semaforo.icono}
                <div className="min-w-0">
                  <p className="text-xs font-extrabold tracking-wide uppercase">
                    {semaforo.titulo}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed">
                    {semaforo.detalle}
                  </p>
                </div>
              </div>
            )}

            {/* Tabla de totales consolidados */}
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 text-sm">
              <div className="flex items-center justify-between py-3">
                <span className="text-slate-600">Total esperado general</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {formatearPesos(simulacion.totalEsperadoGeneral)}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-slate-600">Total declarado general</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {efectivoValido
                    ? formatearPesos(simulacion.totalDeclaradoGeneral)
                    : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-slate-600">
                  Ajuste redondeo (foto RN-04)
                </span>
                <span className="font-mono font-bold text-sky-700 tabular-nums">
                  {efectivoValido
                    ? formatearPesos(simulacion.ajusteRedondeoTotal)
                    : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between py-3.5">
                <span className="font-bold text-slate-900">
                  Diferencia real neta
                </span>
                <span
                  className={`font-mono text-lg font-extrabold tabular-nums ${
                    !efectivoValido
                      ? 'text-slate-400'
                      : simulacion.diferenciaRealTotal === '0.00'
                        ? 'text-emerald-600'
                        : simulacion.diferenciaRealTotal.startsWith('-')
                          ? 'text-rose-600'
                          : 'text-amber-600'
                  }`}
                >
                  {efectivoValido
                    ? formatearPesos(simulacion.diferenciaRealTotal)
                    : '—'}
                </span>
              </div>
            </div>

            {errorSubmit && (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-rose-700"
              >
                {errorSubmit}
              </div>
            )}

            <button
              type="submit"
              disabled={cerrando || !efectivoValido}
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 transition-colors cursor-pointer"
            >
              {cerrando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cerrando turno...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Confirmar Cierre Definitivo</span>
                </>
              )}
            </button>

            <p className="text-[11px] leading-relaxed text-slate-500 text-center">
              Al confirmar, el turno pasará a estado <strong>CERRADO</strong> de
              forma irreversible (RN-05) y se generará el comprobante para
              WhatsApp.
            </p>
          </aside>
        </form>
      </div>
    </AppLayout>
  );
}
