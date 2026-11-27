import { CheckCircle2, Info, Loader2, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import {
  formatearHoraArgentina,
  formatearPesos,
  normalizarEntradaMonetaria,
} from '../lib/formatMoney';
import {
  actualizarConfiguracionRedondeo,
  ApiError,
  obtenerConfiguracionCaja,
  obtenerConfiguracionCajaEnCache,
  type ConfiguracionCajaDetalle,
} from '../services/api';

interface ConfiguracionRedondeoCardProps {
  onConfiguracionActualizada?: () => void;
}

const PRESETS_MARGEN: Array<{ valor: string; etiqueta: string }> = [
  { valor: '0.00', etiqueta: '$0 (Estricto)' },
  { valor: '10.00', etiqueta: '$10' },
  { valor: '100.00', etiqueta: '$100' },
  { valor: '500.00', etiqueta: '$500' },
];

function formatearInputDesdeDecimal(montoDecimal: string): string {
  const [entero = '0', dec = '00'] = montoDecimal.trim().split('.');
  if (dec === '00') return entero;
  return `${entero},${dec}`;
}

export function ConfiguracionRedondeoCard({
  onConfiguracionActualizada,
}: ConfiguracionRedondeoCardProps) {
  const cacheInicial = obtenerConfiguracionCajaEnCache();
  const [config, setConfig] = useState<ConfiguracionCajaDetalle | null>(
    cacheInicial,
  );
  const [valorTexto, setValorTexto] = useState<string>(() =>
    cacheInicial
      ? formatearInputDesdeDecimal(cacheInicial.multiplo_redondeo_efectivo)
      : '0',
  );
  const [cargando, setCargando] = useState(!cacheInicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmacion, setConfirmacion] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    void obtenerConfiguracionCaja()
      .then(({ configuracion }) => {
        if (cancelado) return;
        setConfig(configuracion);
        setValorTexto(
          formatearInputDesdeDecimal(configuracion.multiplo_redondeo_efectivo),
        );
      })
      .catch((err) => {
        if (!cancelado && !cacheInicial) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'No se pudo cargar la configuración de redondeo.',
          );
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (!confirmacion) return;
    const timer = window.setTimeout(() => setConfirmacion(null), 2600);
    return () => window.clearTimeout(timer);
  }, [confirmacion]);

  const decimalSeleccionado = normalizarEntradaMonetaria(valorTexto);
  const esValido =
    decimalSeleccionado !== null && !decimalSeleccionado.startsWith('-');
  const esEstricto = decimalSeleccionado === '0.00';
  const sinCambios =
    Boolean(config) &&
    esValido &&
    decimalSeleccionado === config?.multiplo_redondeo_efectivo;

  async function manejarGuardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setConfirmacion(null);

    if (!decimalSeleccionado || decimalSeleccionado.startsWith('-')) {
      setError('Ingresá un margen válido mayor o igual a $0,00 (RN-04, RN-06).');
      return;
    }

    setGuardando(true);
    try {
      const { configuracion } = await actualizarConfiguracionRedondeo(
        decimalSeleccionado,
      );
      setConfig(configuracion);
      setValorTexto(
        formatearInputDesdeDecimal(configuracion.multiplo_redondeo_efectivo),
      );
      setConfirmacion(
        configuracion.multiplo_redondeo_efectivo === '0.00'
          ? 'Modo estricto ($0,00) activado para próximos cierres.'
          : `Margen de tolerancia actualizado a ${formatearPesos(
              configuracion.multiplo_redondeo_efectivo,
            )}.`,
      );
      onConfiguracionActualizada?.();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('No se pudo guardar la regla de redondeo. Intentá nuevamente.');
      }
    } finally {
      setGuardando(false);
    }
  }

  const vigenteEsEstricto =
    (config?.multiplo_redondeo_efectivo ?? '0.00') === '0.00';

  return (
    <form
      onSubmit={(e) => void manejarGuardar(e)}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between gap-4"
    >
      <div className="space-y-4">
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Configuración de Tolerancia / Redondeo (RF-09)
              </h3>
              <p className="text-xs text-slate-500">
                Aplicable solo a EFECTIVO · Digitales concilian exacto (RN-03)
              </p>
            </div>
          </div>

          {config ? (
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold font-mono tabular-nums ${
                vigenteEsEstricto
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              }`}
            >
              {vigenteEsEstricto
                ? 'Estricto $0,00'
                : `Margen ${formatearPesos(config.multiplo_redondeo_efectivo)}`}
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
              Cargando...
            </span>
          )}
        </div>

        {cargando && !config ? (
          <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Cargando regla de redondeo...</span>
          </div>
        ) : (
          <>
            {/* Presets en 1 clic */}
            <div>
              <p className="text-[11px] font-bold tracking-wider uppercase text-slate-500 mb-2">
                Presets de margen en efectivo
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESETS_MARGEN.map((preset) => {
                  const activo = decimalSeleccionado === preset.valor;
                  return (
                    <button
                      key={preset.valor}
                      type="button"
                      onClick={() => {
                        setValorTexto(formatearInputDesdeDecimal(preset.valor));
                        setError(null);
                        setConfirmacion(null);
                      }}
                      className={`h-9 rounded-xl px-2.5 text-xs font-semibold font-mono tabular-nums transition-colors cursor-pointer ${
                        activo
                          ? 'bg-[#0F172A] text-white shadow-sm'
                          : 'border border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {preset.etiqueta}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Input personalizado >= 0 */}
            <div>
              <label
                htmlFor="input-margen-redondeo"
                className="block text-[11px] font-bold tracking-wider uppercase text-slate-500 mb-1.5"
              >
                Valor personalizado (&gt;= $0,00)
              </label>
              <div className="flex items-center rounded-xl border border-slate-300 bg-white px-3.5 py-2 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10">
                <span className="font-mono text-base font-bold text-slate-500 mr-1.5">
                  $
                </span>
                <input
                  id="input-margen-redondeo"
                  type="text"
                  inputMode="decimal"
                  value={valorTexto}
                  onChange={(e) => {
                    setValorTexto(e.target.value);
                    setError(null);
                    setConfirmacion(null);
                  }}
                  placeholder="0,00"
                  className="w-full font-mono text-lg font-bold text-slate-900 tabular-nums outline-none bg-transparent"
                />
                <span className="font-mono text-[11px] font-semibold text-slate-400 ml-2">
                  ARS
                </span>
              </div>
            </div>

            {/* Simulación en vivo del comportamiento determinístico */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-600">
              {!esValido ? (
                <span className="text-rose-600 font-medium">
                  Ingresá un valor numérico mayor o igual a $0,00.
                </span>
              ) : esEstricto ? (
                <span>
                  <strong>Modo estricto ($0,00):</strong> no se absorbe ningún
                  faltante; cualquier diferencia en efectivo se imputa en el
                  cierre. Todo sobrante queda para la empresa y alerta posible
                  reclamo de cliente (RN-07).
                </span>
              ) : (
                <span>
                  <strong>Margen activo ({formatearPesos(decimalSeleccionado)}):</strong>{' '}
                  faltantes menores a{' '}
                  <span className="font-mono font-semibold text-slate-800">
                    {formatearPesos(decimalSeleccionado)}
                  </span>{' '}
                  se absorben en ajuste por redondeo (auditado mensualmente por
                  cajero); si el faltante es igual o mayor, se imputa completo.
                  Sobrantes mayores al margen disparan alerta de posible reclamo
                  (RN-04, RN-07).
                </span>
              )}
            </div>

            {/* Aviso inmutabilidad histórica RN-04 */}
            <div className="flex items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-900">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Este cambio aplica <strong>solo a cierres futuros</strong>; los
                arqueos ya cerrados conservan su regla original como foto
                histórica inmutable (RN-04).
              </span>
            </div>
          </>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-700"
          >
            {error}
          </div>
        )}

        {confirmacion && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{confirmacion}</span>
          </div>
        )}
      </div>

      {/* Pie con auditoría y acción */}
      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-[11px] text-slate-500">
          {config ? (
            <>
              Último cambio:{' '}
              <strong className="text-slate-700">
                {config.usuario_actualizacion?.nombre_completo ?? 'Encargado'}
              </strong>{' '}
              ·{' '}
              <span className="font-mono tabular-nums">
                {formatearHoraArgentina(config.fecha_ultima_actualizacion)} hs
              </span>
            </>
          ) : (
            'Auditoría automática al guardar'
          )}
        </p>

        <button
          type="submit"
          disabled={cargando || guardando || !esValido || sinCambios}
          className="h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 text-xs sm:text-sm font-semibold text-white inline-flex items-center justify-center gap-2 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
        >
          {guardando ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Guardando...</span>
            </>
          ) : (
            <span>Guardar regla de redondeo</span>
          )}
        </button>
      </div>
    </form>
  );
}
