import { AlertCircle, RefreshCw, X } from 'lucide-react';

interface ConflictBannerProps {
  message: string;
  onRefresh?: () => void;
  onClose?: () => void;
}

export function ConflictBanner({
  message,
  onRefresh,
  onClose,
}: ConflictBannerProps) {
  return (
    <div
      role="alert"
      className="flex flex-col sm:flex-row sm:items-center gap-3 w-full p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 shadow-sm"
    >
      <div className="flex items-start gap-3 flex-1">
        <div className="p-2 rounded-lg bg-amber-100 text-amber-700 shrink-0">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div className="text-sm font-medium leading-relaxed">{message}</div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-200/80 hover:bg-amber-200 text-amber-950 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualizar estado</span>
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar aviso"
            className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
