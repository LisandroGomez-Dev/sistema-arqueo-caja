import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Info,
  Loader2,
  Lock,
  PlusCircle,
  ShieldAlert,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import {
  formatearFechaHoraArgentina,
  formatearPesos,
} from '../lib/formatMoney';
import { generarResumenWhatsApp } from '../lib/motorArqueo';
import {
  ApiError,
  obtenerArqueoEnCache,
  obtenerArqueoPorId,
  type ArqueoCierre,
} from '../services/api';

function bannerResultado(arqueo: ArqueoCierre) {
  switch (arqueo.estado_resultado) {
    case 'CUADRE_PERFECTO':
      return {
        clase: 'border-emerald-200 bg-emerald-50 text-emerald-900',
        icono: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
        titulo: 'Cuadre perfecto ($ 0,00)',
        subtitulo:
          'Todos los canales conciliaron exactamente sin ajustes ni diferencias.',
      };
    case 'DENTRO_TOLERANCIA':
      return {
        clase: 'border-sky-200 bg-sky-50 text-sky-900',
        icono: <Info className="w-5 h-5 text-sky-600 shrink-0" />,
        titulo: 'Cerrado dentro de tolerancia / redondeo',
        subtitulo: `Ajuste absorbido por margen: ${formatearPesos(arqueo.ajuste_redondeo_total)} (regla ${formatearPesos(arqueo.multiplo_redondeo_aplicado)}). Diferencia real: $ 0,00.`,
      };
    case 'SOBRANTE':
      return {
        clase: 'border-amber-200 bg-amber-50 text-amber-900',
        icono: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
        titulo: `Sobrante real: +${formatearPesos(arqueo.diferencia_real_total)}`,
        subtitulo: arqueo.alerta_posible_reclamo_cliente
          ? 'A favor de la empresa. Alerta: supera el margen configurado (posible reclamo de cliente · RN-07).'
          : 'Registrado a favor de la empresa (RN-07).',
      };
    case 'FALTANTE':
      return {
        clase: 'border-rose-200 bg-rose-50 text-rose-900',
        icono: <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />,
        titulo: `Faltante real: ${formatearPesos(arqueo.diferencia_real_total)}`,
        subtitulo: 'Diferencia imputada al cierre definitivo del turno.',
      };
  }
}

export function ComprobanteCierrePage() {
  const { idArqueo } = useParams<{ idArqueo: string }>();
  const location = useLocation();
  const { usuario, turnoActivo, setTurnoActivo } = useAuth();

  const estadoNav = location.state as { arqueoInicial?: ArqueoCierre } | null;
  const arqueoInicial = idArqueo
    ? (estadoNav?.arqueoInicial ?? obtenerArqueoEnCache(idArqueo))
    : null;

  const [arqueo, setArqueo] = useState<ArqueoCierre | null>(arqueoInicial);
  const [cargando, setCargando] = useState(Boolean(idArqueo) && !arqueoInicial);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!idArqueo) return;
    let cancelado = false;

    void obtenerArqueoPorId(idArqueo)
      .then(({ arqueo: cargado }) => {
        if (!cancelado) setArqueo(cargado);
      })
      .catch((err) => {
        if (!cancelado && !arqueoInicial) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'No se pudo cargar el comprobante de cierre.',
          );
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [idArqueo, arqueoInicial]);

  useEffect(() => {
    if (arqueo && turnoActivo && turnoActivo.id_turno === arqueo.id_turno) {
      setTurnoActivo(null);
    }
  }, [arqueo, turnoActivo, setTurnoActivo]);

  async function manejarCopiarWhatsApp() {
    if (!arqueo) return;
    const texto = generarResumenWhatsApp(arqueo);

    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2600);
    } catch {
      const area = document.createElement('textarea');
      area.value = texto;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2600);
    }
  }

  if (cargando) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
            <span>Cargando comprobante de cierre...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !arqueo) {
    return (
      <AppLayout>
        <div className="max-w-xl mx-auto mt-10 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800 space-y-3">
          <p className="font-semibold">
            {error ?? 'No se encontró el comprobante de arqueo solicitado.'}
          </p>
          <Link
            to={usuario?.rol_usuario === 'ENCARGADO' ? '/admin' : '/apertura'}
            className="inline-flex items-center gap-1.5 text-sm font-semibold underline"
          >
            <span>Volver al inicio</span>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const banner = bannerResultado(arqueo);
  const textoWhatsApp = generarResumenWhatsApp(arqueo);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Cabecera */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 text-white px-3 py-1 text-[11px] font-bold mb-2">
              <Lock className="w-3 h-3" />
              <span>TURNO CERRADO Y BLOQUEADO (RN-05)</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Comprobante de Cierre — Caja #{arqueo.caja.numero_caja}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {arqueo.nombre_comercio} · Cerrado{' '}
              {formatearFechaHoraArgentina(arqueo.fecha_hora_cierre)} hs por{' '}
              <strong className="text-slate-700">
                {arqueo.usuario_cierre.nombre_completo}
              </strong>
            </p>
          </div>

          <button
            type="button"
            onClick={() => void manejarCopiarWhatsApp()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors cursor-pointer shrink-0"
          >
            {copiado ? (
              <>
                <Check className="w-4 h-4" />
                <span>¡Resumen copiado!</span>
              </>
            ) : (
              <>
                <ClipboardCopy className="w-4 h-4" />
                <span>Copiar Resumen WhatsApp</span>
              </>
            )}
          </button>
        </header>

        {/* Semáforo de resultado */}
        <div
          className={`rounded-2xl border p-5 flex items-start gap-3.5 ${banner.clase}`}
        >
          {banner.icono}
          <div>
            <h2 className="text-base font-extrabold">{banner.titulo}</h2>
            <p className="mt-0.5 text-sm">{banner.subtitulo}</p>
          </div>
        </div>

        {/* Resumen principal */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <section className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900">
                Desglose por método de pago
              </h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold font-mono text-slate-600">
                Foto redondeo:{' '}
                {arqueo.multiplo_redondeo_aplicado === '0.00'
                  ? '$ 0,00 (Estricto)'
                  : formatearPesos(arqueo.multiplo_redondeo_aplicado)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-bold tracking-wider uppercase text-slate-500">
                    <th className="py-2 pr-3">MÉTODO</th>
                    <th className="py-2 px-2 text-right">ESPERADO</th>
                    <th className="py-2 px-2 text-right">DECLARADO</th>
                    <th className="py-2 px-2 text-right">AJUSTE</th>
                    <th className="py-2 pl-2 text-right">DIF. REAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {arqueo.detalles.map((d) => (
                    <tr key={d.id_detalle_arqueo}>
                      <td className="py-3 pr-3 font-semibold text-slate-800">
                        {d.nombre_metodo}
                      </td>
                      <td className="py-3 px-2 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {formatearPesos(d.monto_esperado)}
                      </td>
                      <td className="py-3 px-2 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                        {formatearPesos(d.monto_declarado)}
                      </td>
                      <td className="py-3 px-2 text-right font-mono tabular-nums text-sky-700 whitespace-nowrap">
                        {formatearPesos(d.ajuste_redondeo)}
                      </td>
                      <td
                        className={`py-3 pl-2 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                          d.diferencia_real === '0.00'
                            ? 'text-emerald-600'
                            : d.diferencia_real.startsWith('-')
                              ? 'text-rose-600'
                              : 'text-amber-600'
                        }`}
                      >
                        {formatearPesos(d.diferencia_real)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 font-bold text-slate-900">
                    <td className="py-3 pr-3">TOTALES</td>
                    <td className="py-3 px-2 text-right font-mono tabular-nums whitespace-nowrap">
                      {formatearPesos(arqueo.total_esperado_general)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono tabular-nums whitespace-nowrap">
                      {formatearPesos(arqueo.total_declarado_general)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono tabular-nums text-sky-700 whitespace-nowrap">
                      {formatearPesos(arqueo.ajuste_redondeo_total)}
                    </td>
                    <td className="py-3 pl-2 text-right font-mono tabular-nums whitespace-nowrap">
                      {formatearPesos(arqueo.diferencia_real_total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {arqueo.observaciones_cierre && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs text-slate-700">
                <strong>Observaciones:</strong> {arqueo.observaciones_cierre}
              </div>
            )}
          </section>

          {/* Vista previa WhatsApp + acciones siguientes */}
          <aside className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <p className="text-[11px] font-bold tracking-wider uppercase text-slate-500">
                VISTA PREVIA TEXTO WHATSAPP
              </p>
              <pre className="rounded-xl bg-slate-900 text-slate-100 p-4 text-xs leading-relaxed font-mono whitespace-pre-wrap overflow-x-auto">
                {textoWhatsApp}
              </pre>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <Link
                to="/apertura"
                className="flex-1 h-11 rounded-xl bg-[#0F172A] hover:bg-slate-800 px-4 text-sm font-semibold text-white inline-flex items-center justify-center gap-2 transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Abrir Nuevo Turno</span>
              </Link>

              {usuario?.rol_usuario === 'ENCARGADO' && (
                <Link
                  to="/admin"
                  className="flex-1 h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 text-sm font-semibold text-slate-700 inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Cajas en Vivo</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
