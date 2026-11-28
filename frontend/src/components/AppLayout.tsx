import {
  Clock,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Monitor,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatearHoraArgentina } from '../lib/formatMoney';

export function AppLayout({ children }: { children: ReactNode }) {
  const { usuario, turnoActivo, cerrarSesion } = useAuth();
  const location = useLocation();
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

  const esEncargado = usuario?.rol_usuario === 'ENCARGADO';
  const iniciales = (usuario?.nombre_completo ?? 'OP')
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  const linkClass = (path: string) =>
    `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
      location.pathname === path
        ? 'bg-slate-800 text-white'
        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
    }`;

  const contenidoSidebar = (
    <div className="flex h-full flex-col justify-between bg-[#0F172A] text-slate-100 p-4">
      <div>
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <span className="text-xl font-extrabold tracking-tight text-white">
              ArqueoCaja
            </span>
            <button
              type="button"
              onClick={() => setMenuMovilAbierto(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {turnoActivo ? (
            <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-950/80 border border-emerald-700/50 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>
                CAJA {turnoActivo.caja.numero_caja} ·{' '}
                {formatearHoraArgentina(turnoActivo.fecha_hora_apertura)}
              </span>
            </div>
          ) : (
            <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-slate-800 border border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              <span>{esEncargado ? 'MODO SUPERVISIÓN' : 'SIN CAJA ABIERTA'}</span>
            </div>
          )}
        </div>

        <nav className="space-y-5">
          {esEncargado ? (
            <>
              <div>
                <p className="px-2.5 mb-2 text-[11px] font-bold tracking-wider uppercase text-slate-500">
                  GESTIÓN
                </p>
                <div className="space-y-1">
                  <Link
                    to="/admin"
                    onClick={() => setMenuMovilAbierto(false)}
                    className={linkClass('/admin')}
                  >
                    <LayoutDashboard className="w-4 h-4 shrink-0" />
                    <span>Cajas en Vivo</span>
                  </Link>

                  <div
                    title="Disponible en Milestone v0.3 (Issue #7)"
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 cursor-not-allowed"
                  >
                    <span className="flex items-center gap-2.5">
                      <SlidersHorizontal className="w-4 h-4 shrink-0" />
                      <span>Historial e Incidencias</span>
                    </span>
                    <span className="text-[10px] rounded bg-slate-800 px-1.5 py-0.5 text-slate-400">
                      v0.3
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <p className="px-2.5 mb-2 text-[11px] font-bold tracking-wider uppercase text-slate-500">
                  MI TURNO
                </p>
                <div className="space-y-1">
                  {turnoActivo ? (
                    <>
                      <Link
                        to="/mostrador"
                        onClick={() => setMenuMovilAbierto(false)}
                        className={linkClass('/mostrador')}
                      >
                        <Monitor className="w-4 h-4 shrink-0" />
                        <span>Mi Caja #{turnoActivo.caja.numero_caja}</span>
                      </Link>
                      <Link
                        to="/cierre"
                        onClick={() => setMenuMovilAbierto(false)}
                        className={linkClass('/cierre')}
                      >
                        <Lock className="w-4 h-4 shrink-0" />
                        <span>Arqueo y Cierre 1-Clic</span>
                      </Link>
                    </>
                  ) : (
                    <Link
                      to="/apertura"
                      onClick={() => setMenuMovilAbierto(false)}
                      className={linkClass('/apertura')}
                    >
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>Cubrir una Caja</span>
                    </Link>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div>
              <p className="px-2.5 mb-2 text-[11px] font-bold tracking-wider uppercase text-slate-500">
                MI CAJA
              </p>
              <div className="space-y-1">
                {!turnoActivo ? (
                  <Link
                    to="/apertura"
                    onClick={() => setMenuMovilAbierto(false)}
                    className={linkClass('/apertura')}
                  >
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>Apertura de Caja</span>
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/mostrador"
                      onClick={() => setMenuMovilAbierto(false)}
                      className={linkClass('/mostrador')}
                    >
                      <Monitor className="w-4 h-4 shrink-0" />
                      <span>Caja #{turnoActivo.caja.numero_caja}</span>
                    </Link>

                    <Link
                      to="/cierre"
                      onClick={() => setMenuMovilAbierto(false)}
                      className={linkClass('/cierre')}
                    >
                      <Lock className="w-4 h-4 shrink-0" />
                      <span>Arqueo y Cierre 1-Clic</span>
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </nav>
      </div>

      {usuario && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                esEncargado ? 'bg-amber-600' : 'bg-emerald-600'
              }`}
            >
              {iniciales}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {usuario.nombre_completo}
              </p>
              <p className="text-xs text-slate-400">
                {esEncargado ? 'Encargado' : 'Cajero'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={cerrarSesion}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cambiar operador</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row">
      <header className="lg:hidden flex items-center justify-between bg-[#0F172A] text-white px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMenuMovilAbierto(true)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-extrabold tracking-tight">ArqueoCaja</span>
        </div>
        <span className="text-xs font-medium text-slate-300">
          {usuario?.nombre_completo}
        </span>
      </header>

      <aside className="hidden lg:block lg:w-64 lg:shrink-0">
        <div className="sticky top-0 h-screen">{contenidoSidebar}</div>
      </aside>

      {menuMovilAbierto && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMenuMovilAbierto(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full">
            {contenidoSidebar}
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
