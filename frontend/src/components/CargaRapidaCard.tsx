import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { normalizarEntradaMonetaria } from '../lib/formatMoney';
import {
  ApiError,
  registrarMovimientoTurno,
  type CodigoMetodoPago,
  type MovimientoCaja,
  type TipoMovimiento,
  type TurnoActivo,
} from '../services/api';

interface CargaRapidaCardProps {
  idTurno: string;
  onMovimientoRegistrado: (
    movimiento: MovimientoCaja,
    turnoActualizado: TurnoActivo,
  ) => void;
}

const METODOS_OPCIONES: Array<{
  codigo: CodigoMetodoPago;
  etiqueta: string;
}> = [
  { codigo: 'EFECTIVO', etiqueta: 'Efectivo' },
  { codigo: 'QR_TRANSFERENCIA', etiqueta: 'QR/Transf' },
  { codigo: 'TARJETA', etiqueta: 'Tarjeta' },
];

export function CargaRapidaCard({
  idTurno,
  onMovimientoRegistrado,
}: CargaRapidaCardProps) {
  const [tipo, setTipo] = useState<TipoMovimiento>('INGRESO');
  const [metodo, setMetodo] = useState<CodigoMetodoPago>('EFECTIVO');
  const [montoTexto, setMontoTexto] = useState('');
  const [concepto, setConcepto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmacion, setConfirmacion] = useState<string | null>(null);

  const inputMontoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function manejarAtajos(e: KeyboardEvent) {
      if (e.key === 'F1') {
        e.preventDefault();
        setTipo('INGRESO');
        setError(null);
        inputMontoRef.current?.focus();
      } else if (e.key === 'F2') {
        e.preventDefault();
        setTipo('EGRESO');
        setError(null);
        inputMontoRef.current?.focus();
      }
    }

    window.addEventListener('keydown', manejarAtajos);
    return () => window.removeEventListener('keydown', manejarAtajos);
  }, []);

  useEffect(() => {
    if (!confirmacion) return;
    const timer = window.setTimeout(() => setConfirmacion(null), 2200);
    return () => window.clearTimeout(timer);
  }, [confirmacion]);

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setConfirmacion(null);

    const decimal = normalizarEntradaMonetaria(montoTexto);
    if (!decimal || decimal.startsWith('-') || decimal === '0.00') {
      setError('Ingresá un importe mayor a $0,00 (RN-06).');
      inputMontoRef.current?.focus();
      return;
    }

    const conceptoLimpio = concepto.trim();
    if (tipo === 'EGRESO' && !conceptoLimpio) {
      setError('En todo egreso debés ingresar un concepto obligatorio (RN-06).');
      return;
    }

    setEnviando(true);
    try {
      const { movimiento, turno } = await registrarMovimientoTurno(idTurno, {
        tipo_movimiento: tipo,
        codigo_metodo_pago: metodo,
        monto_operacion: decimal,
        concepto_descripcion: conceptoLimpio || null,
        origen_carga: 'MANUAL',
      });

      onMovimientoRegistrado(movimiento, turno);
      setMontoTexto('');
      setConcepto('');
      setConfirmacion(
        `${tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'} registrado correctamente.`,
      );
      inputMontoRef.current?.focus();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('No se pudo registrar el movimiento. Intentá nuevamente.');
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => void manejarSubmit(e)}
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4"
      >
        <p className="text-[11px] font-bold tracking-wider uppercase text-slate-500">
          CARGA RÁPIDA MANUAL (3 CLICS)
        </p>

        {/* Toggle Ingreso / Egreso */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              setTipo('INGRESO');
              setError(null);
            }}
            className={`h-11 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              tipo === 'INGRESO'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            + INGRESO (F1)
          </button>

          <button
            type="button"
            onClick={() => {
              setTipo('EGRESO');
              setError(null);
            }}
            className={`h-11 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              tipo === 'EGRESO'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            - EGRESO (F2)
          </button>
        </div>

        {/* Selector de método de pago (RN-02) */}
        <div className="grid grid-cols-3 gap-2">
          {METODOS_OPCIONES.map((op) => {
            const activo = metodo === op.codigo;
            return (
              <button
                key={op.codigo}
                type="button"
                onClick={() => setMetodo(op.codigo)}
                className={`h-10 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activo
                    ? 'bg-[#0F172A] text-white shadow-sm'
                    : 'border border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {op.etiqueta}
              </button>
            );
          })}
        </div>

        {/* Input de monto */}
        <div className="flex items-center rounded-xl border-2 border-slate-900 bg-white px-4 py-3 focus-within:ring-4 focus-within:ring-indigo-500/15">
          <span className="font-mono text-xl font-bold text-slate-500 mr-2">
            $
          </span>
          <input
            ref={inputMontoRef}
            type="text"
            inputMode="decimal"
            value={montoTexto}
            onChange={(e) => {
              setMontoTexto(e.target.value);
              setError(null);
            }}
            placeholder="0,00"
            aria-label="Importe del movimiento"
            className="w-full font-mono text-2xl font-bold text-slate-900 tabular-nums outline-none bg-transparent"
          />
          <span className="font-mono text-xs font-semibold text-slate-400 ml-2">
            ARS
          </span>
        </div>

        {/* Concepto */}
        <div>
          <input
            type="text"
            value={concepto}
            onChange={(e) => {
              setConcepto(e.target.value);
              setError(null);
            }}
            maxLength={300}
            placeholder={
              tipo === 'EGRESO'
                ? 'Motivo del egreso (obligatorio · RN-06)'
                : 'Concepto (opcional en ingresos)'
            }
            aria-label="Concepto del movimiento"
            className={`w-full h-11 rounded-xl border px-3.5 text-sm outline-none transition-colors ${
              tipo === 'EGRESO' && !concepto.trim()
                ? 'border-rose-200 bg-rose-50/30 placeholder:text-rose-400 focus:border-rose-400'
                : 'border-slate-200 bg-slate-50/60 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white'
            }`}
          />
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-rose-700"
          >
            {error}
          </div>
        )}

        {confirmacion && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs sm:text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{confirmacion}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="w-full h-12 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 transition-colors cursor-pointer"
        >
          {enviando ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Registrando...</span>
            </>
          ) : (
            <span>Registrar Movimiento (Enter)</span>
          )}
        </button>
      </form>

      {/* Tarjeta discreta Copiloto IA 24/7 */}
      <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/60 px-4 py-3.5 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed text-indigo-900">
          ¿Querés dictar, subir foto de ticket o consultar soporte de turno? El{' '}
          <span className="font-semibold">Chat Copiloto IA 24/7 (Ctrl+K)</span>{' '}
          se habilitará desde la derecha en <span className="font-semibold">v0.4</span>.
        </p>
      </div>
    </div>
  );
}
