import { Ban, Loader2, RefreshCw, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import {
  formatearHoraArgentina,
  formatearPesos,
  normalizarEntradaMonetaria,
} from '../lib/formatMoney';
import {
  anularMovimientoTurno,
  ApiError,
  type CodigoMetodoPago,
  type MovimientoCaja,
  type TipoMovimiento,
  type TurnoActivo,
} from '../services/api';

interface ModalAnulacionProps {
  movimiento: MovimientoCaja;
  onCerrar: () => void;
  onAnulado: (
    movimiento: MovimientoCaja,
    turnoActualizado: TurnoActivo,
    movimientoReemplazo: MovimientoCaja | null,
  ) => void;
}

const MOTIVOS_RAPIDOS = [
  'Error de tipeo',
  'Monto duplicado',
  'Método de pago incorrecto',
  'Devolución al cliente',
];

const METODOS_OPCIONES: Array<{
  codigo: CodigoMetodoPago;
  etiqueta: string;
}> = [
  { codigo: 'EFECTIVO', etiqueta: 'Efectivo' },
  { codigo: 'QR_TRANSFERENCIA', etiqueta: 'QR/Transf' },
  { codigo: 'TARJETA', etiqueta: 'Tarjeta' },
];

function formatearInputDesdeDecimal(montoDecimal: string): string {
  const [entero = '0', dec = '00'] = montoDecimal.trim().split('.');
  if (dec === '00') return entero;
  return `${entero},${dec}`;
}

export function ModalAnulacion({
  movimiento,
  onCerrar,
  onAnulado,
}: ModalAnulacionProps) {
  const [motivo, setMotivo] = useState('');
  const [registrarReemplazo, setRegistrarReemplazo] = useState(false);
  const [tipoReemplazo, setTipoReemplazo] = useState<TipoMovimiento>(
    movimiento.tipo_movimiento,
  );
  const [metodoReemplazo, setMetodoReemplazo] = useState<CodigoMetodoPago>(
    (movimiento.metodo_pago.codigo_metodo as CodigoMetodoPago) || 'EFECTIVO',
  );
  const [montoReemplazoTexto, setMontoReemplazoTexto] = useState(() =>
    formatearInputDesdeDecimal(movimiento.monto_operacion),
  );
  const [conceptoReemplazo, setConceptoReemplazo] = useState(
    movimiento.concepto_descripcion ?? '',
  );
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function manejarEsc(e: KeyboardEvent) {
      if (e.key === 'Escape' && !enviando) {
        onCerrar();
      }
    }
    window.addEventListener('keydown', manejarEsc);
    return () => window.removeEventListener('keydown', manejarEsc);
  }, [enviando, onCerrar]);

  async function manejarConfirmacion(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const motivoLimpio = motivo.trim();
    if (motivoLimpio.length < 3) {
      setError(
        'Ingresá un motivo obligatorio de al menos 3 caracteres (RN-01).',
      );
      return;
    }

    let payloadReemplazo: {
      tipo_movimiento: TipoMovimiento;
      codigo_metodo_pago: CodigoMetodoPago;
      monto_operacion: string;
      concepto_descripcion: string | null;
    } | null = null;

    if (registrarReemplazo) {
      const decimal = normalizarEntradaMonetaria(montoReemplazoTexto);
      if (!decimal || decimal.startsWith('-') || decimal === '0.00') {
        setError('Ingresá el importe real corregido mayor a $0,00 (RN-06).');
        return;
      }

      const conceptoLimpio = conceptoReemplazo.trim();
      if (tipoReemplazo === 'EGRESO' && !conceptoLimpio) {
        setError(
          'En todo egreso debés ingresar un concepto obligatorio (RN-06).',
        );
        return;
      }

      const conceptoOriginal = movimiento.concepto_descripcion?.trim() || null;
      const conceptoNuevo = conceptoLimpio || null;
      const esIdentico =
        tipoReemplazo === movimiento.tipo_movimiento &&
        metodoReemplazo === movimiento.metodo_pago.codigo_metodo &&
        decimal === movimiento.monto_operacion &&
        conceptoNuevo === conceptoOriginal;

      if (esIdentico) {
        setError(
          'El movimiento corregido es idéntico al original. Modificá el importe, método, tipo o concepto, o destildá el reemplazo.',
        );
        return;
      }

      payloadReemplazo = {
        tipo_movimiento: tipoReemplazo,
        codigo_metodo_pago: metodoReemplazo,
        monto_operacion: decimal,
        concepto_descripcion: conceptoNuevo,
      };
    }

    setEnviando(true);
    try {
      const {
        movimiento: movAnulado,
        movimiento_reemplazo,
        turno,
      } = await anularMovimientoTurno(
        movimiento.id_movimiento,
        motivoLimpio,
        payloadReemplazo,
      );
      onAnulado(movAnulado, turno, movimiento_reemplazo);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('No se pudo anular el movimiento. Intentá nuevamente.');
      }
    } finally {
      setEnviando(false);
    }
  }

  const esIngreso = movimiento.tipo_movimiento === 'INGRESO';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-anulacion"
    >
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        <div className="shrink-0 flex items-center justify-between px-6 py-4 bg-[#0F172A] text-white">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-rose-500/20 text-rose-300 flex items-center justify-center">
              <Ban className="w-4 h-4" />
            </div>
            <div>
              <h2 id="titulo-modal-anulacion" className="text-sm font-bold">
                Anular Movimiento (RN-01)
              </h2>
              <p className="text-[11px] text-slate-300">
                Auditoría inmutable — acción exclusiva de Encargado (RN-08)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            disabled={enviando}
            aria-label="Cerrar modal"
            className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => void manejarConfirmacion(e)}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Resumen del movimiento a anular */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono">
                    {formatearHoraArgentina(movimiento.fecha_hora_registro)} hs
                  </span>
                  <span>·</span>
                  <span className="font-semibold">
                    {movimiento.metodo_pago.nombre_metodo}
                  </span>
                </div>
                <p className="mt-1 font-semibold text-slate-900 truncate">
                  {movimiento.concepto_descripcion ||
                    (esIngreso ? 'Venta mostrador' : 'Egreso')}
                </p>
              </div>

              <div
                className={`font-mono text-lg font-bold tabular-nums shrink-0 ${
                  esIngreso ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {esIngreso ? '+' : '-'}
                {formatearPesos(movimiento.monto_operacion).replace('$ ', '$')}
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-600 rounded-xl bg-amber-50 border border-amber-200/80 px-3.5 py-2.5">
              El asiento erróneo <strong>no se elimina</strong> de la base de
              datos: quedará visible y tachado en el Libro Diario dejando
              constancia de tu usuario, hora exacta y motivo.
            </p>

            {/* Motivos rápidos */}
            <div>
              <p className="text-[11px] font-bold tracking-wider uppercase text-slate-500 mb-2">
                Motivos frecuentes
              </p>
              <div className="flex flex-wrap gap-1.5">
                {MOTIVOS_RAPIDOS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setMotivo(item);
                      setError(null);
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                      motivo === item
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="motivo-anulacion"
                className="block text-xs font-bold tracking-wider uppercase text-slate-500 mb-1.5"
              >
                Motivo obligatorio de anulación
              </label>
              <textarea
                id="motivo-anulacion"
                rows={2}
                autoFocus
                maxLength={300}
                value={motivo}
                onChange={(e) => {
                  setMotivo(e.target.value);
                  setError(null);
                }}
                placeholder="Ej.: Error de tipeo al cobrar en mostrador"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 outline-none"
              />
            </div>

            {/* Opción de anular y reemplazar en la misma transacción */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={registrarReemplazo}
                  onChange={(e) => {
                    setRegistrarReemplazo(e.target.checked);
                    setError(null);
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div className="min-w-0">
                  <span className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-900">
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Registrar movimiento corregido al anular</span>
                  </span>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                    Dejalo destildado si es duplicado o cancelación total. Tildalo
                    para anular el error y cargar el importe real en un solo paso.
                  </p>
                </div>
              </label>

              {registrarReemplazo && (
                <div className="pt-3 border-t border-slate-200/80 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTipoReemplazo('INGRESO');
                        setError(null);
                      }}
                      className={`h-9 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        tipoReemplazo === 'INGRESO'
                          ? 'bg-emerald-600 text-white'
                          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      + Ingreso
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTipoReemplazo('EGRESO');
                        setError(null);
                      }}
                      className={`h-9 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        tipoReemplazo === 'EGRESO'
                          ? 'bg-rose-600 text-white'
                          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      - Egreso
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {METODOS_OPCIONES.map((op) => {
                      const activo = metodoReemplazo === op.codigo;
                      return (
                        <button
                          key={op.codigo}
                          type="button"
                          onClick={() => {
                            setMetodoReemplazo(op.codigo);
                            setError(null);
                          }}
                          className={`h-8 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            activo
                              ? 'bg-[#0F172A] text-white'
                              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {op.etiqueta}
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <label
                      htmlFor="monto-reemplazo"
                      className="block text-[11px] font-bold tracking-wider uppercase text-slate-500 mb-1"
                    >
                      Importe real corregido
                    </label>
                    <div className="flex items-center rounded-xl border border-indigo-300 bg-white px-3 py-2 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10">
                      <span className="font-mono text-base font-bold text-slate-500 mr-1.5">
                        $
                      </span>
                      <input
                        id="monto-reemplazo"
                        type="text"
                        inputMode="decimal"
                        value={montoReemplazoTexto}
                        onChange={(e) => {
                          setMontoReemplazoTexto(e.target.value);
                          setError(null);
                        }}
                        placeholder="0,00"
                        className="w-full font-mono text-lg font-bold text-slate-900 tabular-nums outline-none bg-transparent"
                      />
                      <span className="font-mono text-[11px] font-semibold text-slate-400 ml-2">
                        ARS
                      </span>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="concepto-reemplazo"
                      className="block text-[11px] font-bold tracking-wider uppercase text-slate-500 mb-1"
                    >
                      Concepto del movimiento corregido
                    </label>
                    <input
                      id="concepto-reemplazo"
                      type="text"
                      maxLength={300}
                      value={conceptoReemplazo}
                      onChange={(e) => {
                        setConceptoReemplazo(e.target.value);
                        setError(null);
                      }}
                      placeholder={
                        tipoReemplazo === 'EGRESO'
                          ? 'Motivo del egreso (obligatorio · RN-06)'
                          : 'Concepto (opcional en ingresos)'
                      }
                      className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-rose-700"
              >
                {error}
              </div>
            )}
          </div>

          <div className="shrink-0 flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-100 bg-slate-50/70">
            <button
              type="button"
              onClick={onCerrar}
              disabled={enviando}
              className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancelar (Esc)
            </button>
            <button
              type="submit"
              disabled={enviando || motivo.trim().length < 3}
              className={`h-10 rounded-xl px-5 text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-60 transition-colors cursor-pointer ${
                registrarReemplazo
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {enviando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <span>
                  {registrarReemplazo
                    ? 'Anular y Cargar Corregido'
                    : 'Confirmar Anulación'}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
