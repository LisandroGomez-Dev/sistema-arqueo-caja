import { Loader2, ReceiptText } from 'lucide-react';
import { formatearHoraArgentina, formatearPesos } from '../lib/formatMoney';
import type { MovimientoCaja } from '../services/api';

interface LibroDiarioTableProps {
  movimientos: MovimientoCaja[];
  cargando: boolean;
  puedeAnular?: boolean;
  onSolicitarAnulacion?: (movimiento: MovimientoCaja) => void;
}

function etiquetaMetodo(codigo: string): string {
  if (codigo === 'EFECTIVO') return 'Efectivo';
  if (codigo === 'QR_TRANSFERENCIA') return 'QR/Transf';
  if (codigo === 'TARJETA') return 'Tarjeta';
  return codigo;
}

function badgeOrigen(mov: MovimientoCaja) {
  if (mov.estado_movimiento === 'ANULADO') {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-500">
        ANULADO
      </span>
    );
  }
  if (mov.origen_carga === 'IA_VOZ_TEXTO') {
    return (
      <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-600">
        IA_VOZ
      </span>
    );
  }
  if (mov.origen_carga === 'IA_COMPROBANTE') {
    return (
      <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-600">
        IA_TICKET
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
      MANUAL
    </span>
  );
}

export function LibroDiarioTable({
  movimientos,
  cargando,
  puedeAnular = false,
  onSolicitarAnulacion,
}: LibroDiarioTableProps) {
  const activos = movimientos.filter(
    (m) => m.estado_movimiento === 'ACTIVO',
  ).length;
  const anulados = movimientos.length - activos;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <h2 className="text-base font-extrabold text-slate-900">
          Libro Diario del Turno (Inmutable · RN-01)
        </h2>
        <p className="font-mono text-xs text-slate-500 tabular-nums">
          {movimientos.length} movimientos · {activos} activos
          {anulados > 0 ? ` · ${anulados} anulados` : ''}
        </p>
      </div>

      {cargando && movimientos.length === 0 ? (
        <div className="py-12 flex items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
          <span>Cargando movimientos del turno...</span>
        </div>
      ) : movimientos.length === 0 ? (
        <div className="py-12 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 flex flex-col items-center justify-center text-center px-4">
          <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-2.5">
            <ReceiptText className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-slate-700">
            Todavía no hay movimientos registrados en esta caja
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Usá el panel de Carga Rápida (izquierda) o presioná{' '}
            <span className="font-mono font-semibold">F1</span> /{' '}
            <span className="font-mono font-semibold">F2</span> para registrar el
            primero.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div
            className={`${puedeAnular ? 'min-w-[600px]' : 'min-w-[520px]'} space-y-2`}
          >
            {/* Encabezados */}
            <div
              className={`grid ${
                puedeAnular
                  ? 'grid-cols-[52px_minmax(120px,1fr)_78px_76px_minmax(112px,auto)_78px]'
                  : 'grid-cols-[52px_minmax(140px,1fr)_86px_80px_minmax(116px,auto)]'
              } gap-3 px-3.5 py-2 rounded-lg bg-slate-50 text-[10px] font-bold tracking-wider uppercase text-slate-500`}
            >
              <div>HORA</div>
              <div>CONCEPTO</div>
              <div>MÉTODO</div>
              <div>ORIGEN</div>
              <div className="text-right whitespace-nowrap">IMPORTE</div>
              {puedeAnular && <div className="text-right pl-2">ACCIÓN</div>}
            </div>

            {/* Filas */}
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-0.5">
              {movimientos.map((mov) => {
                const anulado = mov.estado_movimiento === 'ANULADO';
                const esIngreso = mov.tipo_movimiento === 'INGRESO';
                const nombreAnulador =
                  mov.usuario_anulacion?.nombre_completo.split(' ')[0] ?? '';

                return (
                  <div
                    key={mov.id_movimiento}
                    className={`grid ${
                      puedeAnular
                        ? 'grid-cols-[52px_minmax(120px,1fr)_78px_76px_minmax(112px,auto)_78px]'
                        : 'grid-cols-[52px_minmax(140px,1fr)_86px_80px_minmax(116px,auto)]'
                    } gap-3 items-center rounded-xl border px-3.5 py-3 text-sm transition-colors ${
                      anulado
                        ? 'border-slate-200 bg-slate-50/90 text-slate-400'
                        : 'border-slate-200/80 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="font-mono text-xs text-slate-500 tabular-nums">
                      {formatearHoraArgentina(mov.fecha_hora_registro)}
                    </div>

                    <div className="min-w-0">
                      <p
                        className={`truncate font-semibold ${
                          anulado
                            ? 'line-through text-slate-400'
                            : 'text-slate-900'
                        }`}
                      >
                        {mov.concepto_descripcion ||
                          (esIngreso ? 'Venta mostrador' : 'Egreso')}
                      </p>
                      {anulado && mov.motivo_anulacion && (
                        <p
                          className="truncate text-[11px] text-slate-500"
                          title={`Motivo: ${mov.motivo_anulacion}`}
                        >
                          Motivo: {mov.motivo_anulacion}
                        </p>
                      )}
                    </div>

                    <div className="text-xs font-medium text-slate-600">
                      {etiquetaMetodo(mov.metodo_pago.codigo_metodo)}
                    </div>

                    <div>{badgeOrigen(mov)}</div>

                    <div
                      className={`text-right font-mono text-sm font-bold tabular-nums whitespace-nowrap ${
                        anulado
                          ? 'line-through text-slate-400'
                          : esIngreso
                            ? 'text-emerald-600'
                            : 'text-rose-600'
                      }`}
                    >
                      {esIngreso ? '+' : '-'}
                      {formatearPesos(mov.monto_operacion).replace('$ ', '$')}
                    </div>

                    {puedeAnular && (
                      <div className="flex justify-end pl-2 shrink-0">
                        {anulado ? (
                          <span
                            className="text-[11px] font-medium text-slate-400 truncate"
                            title={
                              mov.fecha_hora_anulacion
                                ? `Anulado por ${mov.usuario_anulacion?.nombre_completo ?? ''} a las ${formatearHoraArgentina(mov.fecha_hora_anulacion)}`
                                : undefined
                            }
                          >
                            {nombreAnulador}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSolicitarAnulacion?.(mov)}
                            className="shrink-0 rounded-lg bg-rose-50 hover:bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-600 transition-colors cursor-pointer"
                          >
                            Anular
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
