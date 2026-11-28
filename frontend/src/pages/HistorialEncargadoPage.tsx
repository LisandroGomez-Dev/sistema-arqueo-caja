import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Eye,
  Filter,
  Info,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import {
  formatearFechaHoraArgentina,
  formatearPesos,
} from '../lib/formatMoney';
import { generarResumenWhatsApp } from '../lib/motorArqueo';
import {
  ApiError,
  obtenerCajasConEstado,
  obtenerCajasEnCache,
  obtenerHistorialArqueos,
  obtenerOperadores,
  obtenerOperadoresEnCache,
  type ArqueoCierre,
  type CajaConEstado,
  type EstadoResultadoArqueo,
  type HistorialArqueosResultado,
  type OperadorPublico,
} from '../services/api';

function fechaHoyArgentinaISO(desplazamientoDias = 0): string {
  const fecha = new Date(Date.now() + desplazamientoDias * 86_400_000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fecha);
  const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

function mesActualArgentinaISO(): string {
  return fechaHoyArgentinaISO().slice(0, 7);
}

function badgeEstado(estado: EstadoResultadoArqueo) {
  switch (estado) {
    case 'CUADRE_PERFECTO':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-3 h-3" />
          <span>Exacto</span>
        </span>
      );
    case 'DENTRO_TOLERANCIA':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200 px-2.5 py-0.5 text-[11px] font-bold text-sky-700 whitespace-nowrap">
          <Info className="w-3 h-3" />
          <span>Tolerancia</span>
        </span>
      );
    case 'SOBRANTE':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 whitespace-nowrap">
          <AlertTriangle className="w-3 h-3" />
          <span>Sobrante</span>
        </span>
      );
    case 'FALTANTE':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 whitespace-nowrap">
          <ShieldAlert className="w-3 h-3" />
          <span>Faltante</span>
        </span>
      );
  }
}

export function HistorialEncargadoPage() {
  const opsCache = obtenerOperadoresEnCache()?.operadores ?? [];
  const cajasCache = obtenerCajasEnCache()?.cajas ?? [];

  const [operadores, setOperadores] = useState<OperadorPublico[]>(opsCache);
  const [cajas, setCajas] = useState<CajaConEstado[]>(cajasCache);

  const [mesAcumulado, setMesAcumulado] = useState<string>(() =>
    mesActualArgentinaISO(),
  );
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [idUsuarioFiltro, setIdUsuarioFiltro] = useState<string>('');
  const [idCajaFiltro, setIdCajaFiltro] = useState<string>('');
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoResultadoArqueo | ''>(
    '',
  );

  const [resultado, setResultado] =
    useState<HistorialArqueosResultado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idCopiado, setIdCopiado] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    void Promise.all([
      obtenerOperadores().catch(() => null),
      obtenerCajasConEstado().catch(() => null),
    ]).then(([opsData, cajasData]) => {
      if (cancelado) return;
      if (opsData) setOperadores(opsData.operadores);
      if (cajasData) setCajas(cajasData.cajas);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  const cargarHistorial = useCallback(
    async (esManual = false) => {
      if (esManual) {
        setActualizando(true);
      } else if (!resultado) {
        setCargando(true);
      }
      setError(null);

      try {
        const data = await obtenerHistorialArqueos({
          fecha_desde: fechaDesde || undefined,
          fecha_hasta: fechaHasta || undefined,
          id_usuario: idUsuarioFiltro || undefined,
          id_caja: idCajaFiltro || undefined,
          estado_resultado: estadoFiltro || undefined,
          mes: mesAcumulado || undefined,
        });
        setResultado(data);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'No se pudo consultar el historial de cierres.',
        );
      } finally {
        setCargando(false);
        setActualizando(false);
      }
    },
    [
      fechaDesde,
      fechaHasta,
      idUsuarioFiltro,
      idCajaFiltro,
      estadoFiltro,
      mesAcumulado,
      resultado,
    ],
  );

  useEffect(() => {
    void cargarHistorial(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fechaDesde,
    fechaHasta,
    idUsuarioFiltro,
    idCajaFiltro,
    estadoFiltro,
    mesAcumulado,
  ]);

  function aplicarRangoRapido(tipo: 'hoy' | '7dias' | 'mes' | 'todos') {
    const hoy = fechaHoyArgentinaISO();
    if (tipo === 'hoy') {
      setFechaDesde(hoy);
      setFechaHasta(hoy);
    } else if (tipo === '7dias') {
      setFechaDesde(fechaHoyArgentinaISO(-6));
      setFechaHasta(hoy);
    } else if (tipo === 'mes') {
      const mes = mesAcumulado || mesActualArgentinaISO();
      const [yStr = '2026', mStr = '01'] = mes.split('-');
      const ultimoDia = new Date(
        Date.UTC(Number(yStr), Number(mStr), 0),
      ).getUTCDate();
      setFechaDesde(`${mes}-01`);
      setFechaHasta(`${mes}-${String(ultimoDia).padStart(2, '0')}`);
    } else {
      setFechaDesde('');
      setFechaHasta('');
    }
  }

  function limpiarFiltros() {
    setFechaDesde('');
    setFechaHasta('');
    setIdUsuarioFiltro('');
    setIdCajaFiltro('');
    setEstadoFiltro('');
  }

  async function manejarCopiar(arqueo: ArqueoCierre) {
    const texto = generarResumenWhatsApp(arqueo);
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const area = document.createElement('textarea');
      area.value = texto;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    }
    setIdCopiado(arqueo.id_arqueo);
    window.setTimeout(() => {
      setIdCopiado((prev) => (prev === arqueo.id_arqueo ? null : prev));
    }, 2200);
  }

  const hayFiltrosActivos = Boolean(
    fechaDesde || fechaHasta || idUsuarioFiltro || idCajaFiltro || estadoFiltro,
  );

  const acumulados = resultado?.acumulado_mensual_por_cajero ?? [];
  const arqueos = resultado?.arqueos ?? [];
  const resumen = resultado?.resumen_filtrado;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Cabecera */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a Cajas en Vivo</span>
            </Link>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Historial de Cierres y Acumulado Mensual
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Auditoría histórica de arqueos (RF-05) y seguimiento mensual de
              tolerancia/redondeo por cajero (RN-04 · anti robo hormiga).
            </p>
          </div>

          <button
            type="button"
            onClick={() => void cargarHistorial(true)}
            disabled={actualizando}
            className="self-start md:self-center inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors cursor-pointer"
          >
            <RefreshCw
              className={`w-4 h-4 ${actualizando ? 'animate-spin' : ''}`}
            />
            <span>Actualizar</span>
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
          >
            {error}
          </div>
        )}

        {/* SECCIÓN 1: Acumulado Mensual por Cajero (RN-04) */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Acumulado Mensual de Tolerancia por Cajero (RN-04)
                </h2>
                <p className="text-xs text-slate-500">
                  Hacé clic en un operador para filtrar sus cierres abajo. Marca
                  alerta con 3+ cierres ajustados o ≥ $ 1.000,00 absorbidos en el
                  mes.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Calendar className="w-4 h-4 text-slate-400" />
              <label htmlFor="selector-mes-acumulado" className="sr-only">
                Mes del acumulado
              </label>
              <input
                id="selector-mes-acumulado"
                type="month"
                value={mesAcumulado}
                onChange={(e) => setMesAcumulado(e.target.value)}
                className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {cargando && !resultado ? (
            <div className="py-8 flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span>Calculando acumulados del mes...</span>
            </div>
          ) : acumulados.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 py-6 text-center text-xs sm:text-sm text-slate-500">
              No hay cierres registrados en el mes{' '}
              <span className="font-mono font-semibold">{mesAcumulado}</span>.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-bold tracking-wider uppercase text-slate-500">
                    <th className="py-2.5 pr-3">OPERADOR</th>
                    <th className="py-2.5 px-2 text-right">CIERRES</th>
                    <th className="py-2.5 px-2 text-right">CON TOLERANCIA</th>
                    <th className="py-2.5 px-2 text-right">ACUM. REDONDEO</th>
                    <th className="py-2.5 px-2 text-right">FALTANTES REALES</th>
                    <th className="py-2.5 px-2 text-right">SOBRANTES REALES</th>
                    <th className="py-2.5 px-2 text-right">NETO REAL</th>
                    <th className="py-2.5 pl-3 text-right">SEGUIMIENTO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {acumulados.map((item) => {
                    const seleccionado =
                      idUsuarioFiltro === item.usuario.id_usuario;
                    return (
                      <tr
                        key={item.usuario.id_usuario}
                        onClick={() =>
                          setIdUsuarioFiltro((prev) =>
                            prev === item.usuario.id_usuario
                              ? ''
                              : item.usuario.id_usuario,
                          )
                        }
                        className={`transition-colors cursor-pointer ${
                          seleccionado
                            ? 'bg-indigo-50/80'
                            : 'hover:bg-slate-50/90'
                        }`}
                      >
                        <td className="py-3 pr-3">
                          <p className="font-bold text-slate-900">
                            {item.usuario.nombre_completo}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {item.usuario.rol_usuario} · Declarado:{' '}
                            <span className="font-mono">
                              {formatearPesos(item.total_declarado_mes)}
                            </span>
                          </p>
                        </td>
                        <td className="py-3 px-2 text-right font-mono font-semibold text-slate-800 tabular-nums">
                          {item.cantidad_cierres}
                        </td>
                        <td className="py-3 px-2 text-right font-mono font-semibold text-sky-700 tabular-nums">
                          {item.cierres_con_ajuste_tolerancia}
                        </td>
                        <td
                          className={`py-3 px-2 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                            item.acumulado_ajuste_redondeo === '0.00'
                              ? 'text-slate-500'
                              : 'text-sky-700'
                          }`}
                        >
                          {formatearPesos(item.acumulado_ajuste_redondeo)}
                        </td>
                        <td
                          className={`py-3 px-2 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                            item.acumulado_faltantes_reales === '0.00'
                              ? 'text-slate-400'
                              : 'text-rose-600'
                          }`}
                        >
                          {formatearPesos(item.acumulado_faltantes_reales)}
                        </td>
                        <td
                          className={`py-3 px-2 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                            item.acumulado_sobrantes_reales === '0.00'
                              ? 'text-slate-400'
                              : 'text-amber-600'
                          }`}
                        >
                          {formatearPesos(item.acumulado_sobrantes_reales)}
                        </td>
                        <td
                          className={`py-3 px-2 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                            item.acumulado_diferencia_real === '0.00'
                              ? 'text-emerald-600'
                              : item.acumulado_diferencia_real.startsWith('-')
                                ? 'text-rose-600'
                                : 'text-amber-600'
                          }`}
                        >
                          {formatearPesos(item.acumulado_diferencia_real)}
                        </td>
                        <td className="py-3 pl-3 text-right">
                          {item.alerta_sesgo_tolerancia ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 whitespace-nowrap">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Sesgo a revisar</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 whitespace-nowrap">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Normal</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* SECCIÓN 2: Filtros, Resumen y Listado Histórico de Cierres */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-indigo-600" />
              <h2 className="text-base font-extrabold text-slate-900">
                Historial de Cierres ({arqueos.length})
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => aplicarRangoRapido('hoy')}
                className="rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => aplicarRangoRapido('7dias')}
                className="rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Últimos 7 días
              </button>
              <button
                type="button"
                onClick={() => aplicarRangoRapido('mes')}
                className="rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Este mes
              </button>
              <button
                type="button"
                onClick={() => aplicarRangoRapido('todos')}
                className="rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Todos
              </button>
              {hayFiltrosActivos && (
                <button
                  type="button"
                  onClick={limpiarFiltros}
                  className="rounded-full bg-rose-50 hover:bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 cursor-pointer"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          {/* Controles de filtro */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label
                htmlFor="filtro-fecha-desde"
                className="block text-[10px] font-bold tracking-wider uppercase text-slate-500 mb-1"
              >
                Desde
              </label>
              <input
                id="filtro-fecha-desde"
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-800 outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="filtro-fecha-hasta"
                className="block text-[10px] font-bold tracking-wider uppercase text-slate-500 mb-1"
              >
                Hasta
              </label>
              <input
                id="filtro-fecha-hasta"
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-800 outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="filtro-operador"
                className="block text-[10px] font-bold tracking-wider uppercase text-slate-500 mb-1"
              >
                Operador
              </label>
              <select
                id="filtro-operador"
                value={idUsuarioFiltro}
                onChange={(e) => setIdUsuarioFiltro(e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-800 outline-none focus:border-indigo-500"
              >
                <option value="">Todos los operadores</option>
                {operadores.map((op) => (
                  <option key={op.id_usuario} value={op.id_usuario}>
                    {op.nombre_completo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="filtro-caja"
                className="block text-[10px] font-bold tracking-wider uppercase text-slate-500 mb-1"
              >
                Caja física
              </label>
              <select
                id="filtro-caja"
                value={idCajaFiltro}
                onChange={(e) => setIdCajaFiltro(e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-800 outline-none focus:border-indigo-500"
              >
                <option value="">Todas las cajas</option>
                {cajas.map((c) => (
                  <option key={c.id_caja} value={c.id_caja}>
                    Caja #{c.numero_caja}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="filtro-estado"
                className="block text-[10px] font-bold tracking-wider uppercase text-slate-500 mb-1"
              >
                Resultado
              </label>
              <select
                id="filtro-estado"
                value={estadoFiltro}
                onChange={(e) =>
                  setEstadoFiltro(e.target.value as EstadoResultadoArqueo | '')
                }
                className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-800 outline-none focus:border-indigo-500"
              >
                <option value="">Todos los estados</option>
                <option value="CUADRE_PERFECTO">Cuadre perfecto</option>
                <option value="DENTRO_TOLERANCIA">Dentro de tolerancia</option>
                <option value="SOBRANTE">Sobrante</option>
                <option value="FALTANTE">Faltante</option>
              </select>
            </div>
          </div>

          {/* Tarjetas KPI del resumen filtrado */}
          {resumen && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-3">
                <p className="text-[10px] font-bold tracking-wider uppercase text-slate-500">
                  Cierres filtrados
                </p>
                <p className="mt-1 font-mono text-xl font-extrabold text-slate-900 tabular-nums">
                  {resumen.cantidad_cierres}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-3">
                <p className="text-[10px] font-bold tracking-wider uppercase text-slate-500">
                  Total declarado
                </p>
                <p className="mt-1 font-mono text-xl font-extrabold text-slate-900 tabular-nums">
                  {formatearPesos(resumen.total_declarado)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-3">
                <p className="text-[10px] font-bold tracking-wider uppercase text-slate-500">
                  Ajuste redondeo total
                </p>
                <p className="mt-1 font-mono text-xl font-extrabold text-sky-700 tabular-nums">
                  {formatearPesos(resumen.total_ajuste_redondeo)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-3">
                <p className="text-[10px] font-bold tracking-wider uppercase text-slate-500">
                  Diferencia real neta
                </p>
                <p
                  className={`mt-1 font-mono text-xl font-extrabold tabular-nums ${
                    resumen.total_diferencia_real === '0.00'
                      ? 'text-emerald-600'
                      : resumen.total_diferencia_real.startsWith('-')
                        ? 'text-rose-600'
                        : 'text-amber-600'
                  }`}
                >
                  {formatearPesos(resumen.total_diferencia_real)}
                </p>
              </div>
            </div>
          )}

          {/* Tabla de cierres */}
          {cargando && !resultado ? (
            <div className="py-10 flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              <span>Cargando historial de cierres...</span>
            </div>
          ) : arqueos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 py-10 text-center text-sm text-slate-500">
              No se encontraron cierres con los filtros seleccionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-bold tracking-wider uppercase text-slate-500">
                    <th className="py-2.5 pr-3">FECHA / HORA</th>
                    <th className="py-2.5 px-2">CAJA</th>
                    <th className="py-2.5 px-2">OPERADOR</th>
                    <th className="py-2.5 px-2 text-right">DECLARADO</th>
                    <th className="py-2.5 px-2 text-right">REDONDEO</th>
                    <th className="py-2.5 px-2 text-right">DIF. REAL</th>
                    <th className="py-2.5 px-2">ESTADO</th>
                    <th className="py-2.5 pl-3 text-right">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {arqueos.map((arq) => {
                    const cerradoPorOtro =
                      arq.usuario_cierre.id_usuario !==
                      arq.usuario_apertura.id_usuario;
                    const copiado = idCopiado === arq.id_arqueo;

                    return (
                      <tr key={arq.id_arqueo} className="hover:bg-slate-50/80">
                        <td className="py-3 pr-3 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                          {formatearFechaHoraArgentina(arq.fecha_hora_cierre)} hs
                        </td>
                        <td className="py-3 px-2 whitespace-nowrap">
                          <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-800">
                            Caja #{arq.caja.numero_caja}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <p className="font-semibold text-slate-900">
                            {arq.usuario_apertura.nombre_completo}
                          </p>
                          {cerradoPorOtro && (
                            <p className="text-[11px] text-slate-500">
                              Cerró: {arq.usuario_cierre.nombre_completo}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                          {formatearPesos(arq.total_declarado_general)}
                        </td>
                        <td className="py-3 px-2 text-right font-mono tabular-nums whitespace-nowrap">
                          <span
                            className={
                              arq.ajuste_redondeo_total === '0.00'
                                ? 'text-slate-400'
                                : 'font-semibold text-sky-700'
                            }
                          >
                            {formatearPesos(arq.ajuste_redondeo_total)}
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            regla {formatearPesos(arq.multiplo_redondeo_aplicado)}
                          </span>
                        </td>
                        <td
                          className={`py-3 px-2 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                            arq.diferencia_real_total === '0.00'
                              ? 'text-emerald-600'
                              : arq.diferencia_real_total.startsWith('-')
                                ? 'text-rose-600'
                                : 'text-amber-600'
                          }`}
                        >
                          {formatearPesos(arq.diferencia_real_total)}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {badgeEstado(arq.estado_resultado)}
                            {arq.alerta_posible_reclamo_cliente && (
                              <span
                                title="Sobrante superior al margen (posible reclamo de cliente · RN-07)"
                                className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 whitespace-nowrap"
                              >
                                Reclamo
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pl-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              to={`/cierre/comprobante/${arq.id_arqueo}`}
                              state={{ arqueoInicial: arq }}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Ver</span>
                            </Link>
                            <button
                              type="button"
                              onClick={() => void manejarCopiar(arq)}
                              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                                copiado
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {copiado ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Copiado</span>
                                </>
                              ) : (
                                <>
                                  <ClipboardCopy className="w-3.5 h-3.5" />
                                  <span>WhatsApp</span>
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
